import crypto from 'crypto';
import { query, getClient } from '../config/db.js';
import { processCompletedPayment, createTransaction } from '../models/transactionModel.js';
import { logWebhookEvent } from '../utils/webhookLogger.js';
import { createNotification } from '../models/notificationModel.js';

export const flutterwaveWebhook = async (req, res) => {
  try {
    // =====================================================
    // 1. VERIFY FLUTTERWAVE SIGNATURE
    // =====================================================

    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    const signature = req.headers['verif-hash'];

    if (!secretHash || signature !== secretHash) {
      console.error('[Flutterwave Webhook] Invalid signature');
      return res.status(401).send('Unauthorized');
    }

    const payload = req.body;

    console.log('[Flutterwave Webhook]', payload);

    // =====================================================
    // 2. ONLY PROCESS SUCCESSFUL PAYMENTS
    // =====================================================

    const status =
      payload.status || payload.data?.status;

    if (status !== 'successful') {
      return res.status(200).send('Ignored');
    }

    // =====================================================
    // 3. EXTRACT DATA
    // =====================================================

    const data = payload.data || payload;

    const reference =
      data.tx_ref || data.reference;

    const transactionId =
      data.id?.toString();

    const amount =
      (data.amount || 0);

    const email =
      data.customer?.email;

    // =====================================================
    // 4. FIND USER
    // =====================================================

    const { rows: users } = await query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    const user = users[0];

    if (!user) {
      console.error(
        '[Flutterwave Webhook] User not found',
        email
      );

      return res.status(200).send('User not found');
    }

    // =====================================================
    // 5. CREATE TRANSACTION IF NOT EXISTS
    // =====================================================

    const { rows: existingTx } = await query(
      `SELECT * FROM transactions WHERE reference = $1`,
      [reference]
    );

    if (existingTx.length === 0) {
      await createTransaction(
        user.id,
        null,
        'wallet_topup',
        amount,
        reference,
        'flutterwave'
      );
    }

    // =====================================================
    // 6. PROCESS PAYMENT (CORE LOGIC)
    // =====================================================

    const {
      isDuplicate,
      transaction
    } = await processCompletedPayment(
      reference,
      amount,
      transactionId,
      'flutterwave'
    );

    // =====================================================
    // 7. LOG WEBHOOK
    // =====================================================

    await logWebhookEvent({
      source: 'flutterwave',
      reference,
      eventType: 'charge.completed',
      payload,
      signatureOk: true,
      status: isDuplicate ? 'duplicate' : 'processed',
      note: isDuplicate
        ? 'Duplicate payment'
        : `Wallet credited ₦${amount}`
    });

    // =====================================================
    // 8. NOTIFICATION
    // =====================================================

    if (!isDuplicate) {
      await createNotification(
        user.id,
        'PAYMENT',
        'Wallet Funded',
        `Your wallet has been credited with ₦${amount}`
      );

      console.log(
        `[Flutterwave Webhook] Wallet credited for user ${user.id}`
      );
    }

    // =====================================================
    // 9. RESPONSE
    // =====================================================

    return res.status(200).send('Webhook processed');

  } catch (error) {
    console.error(
      '[Flutterwave Webhook ERROR]',
      error
    );

    await logWebhookEvent({
      source: 'flutterwave',
      reference: null,
      eventType: 'error',
      payload: req.body,
      signatureOk: false,
      status: 'error',
      note: error.message
    });

    return res.status(500).send('Internal Server Error');
  }
};
