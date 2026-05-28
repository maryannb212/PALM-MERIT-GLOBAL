import crypto from 'crypto';
import { query, getClient } from '../config/db.js';
import { processCompletedPayment, createTransaction } from '../models/transactionModel.js';
import { logWebhookEvent } from '../utils/webhookLogger.js';
import { createNotification } from '../models/notificationModel.js';

/**
 * Dedicated Webhook for Virtual Account Payments (Paystack)
 * POST /api/webhook/virtual-account
 */
export const virtualAccountWebhook = async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

  // 1. Signature Verification
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(rawBody);
  if (event.event !== 'charge.success') {
    return res.status(200).send('Event ignored');
  }

  const data = event.data;
  const reference = data.reference;
  const amount = data.amount / 100; // kobo to NGN
  
  // Dedicated NUBAN specific logic
  const accountNumber = data.dedicated_account?.account_number;
  
  if (!accountNumber) {
    return res.status(200).send('Not a virtual account payment');
  }

  try {
    // 2. Find user by virtual account number
    const { rows } = await query('SELECT id, email FROM users WHERE virtual_account_number = $1', [accountNumber]);
    const user = rows[0];

    if (!user) {
      console.error(`[VA Webhook] No user found for account ${accountNumber}`);
      return res.status(200).send('User not found');
    }

    // 3. Create a transaction record if it doesn't exist (since this was an external transfer)
    // We check if this reference already exists to avoid duplication
    const { rows: existingTx } = await query('SELECT * FROM transactions WHERE reference = $1', [reference]);
    
    if (existingTx.length === 0) {
      await createTransaction(
        user.id, 
        null, 
        'wallet_topup', 
        amount, 
        reference, 
        'paystack'
      );
    }

    // 4. Process the payment (Idempotent)
    const { isDuplicate, transaction } = await processCompletedPayment(
      reference,
      amount,
      data.id?.toString(),
      'paystack'
    );

    const logStatus = isDuplicate ? 'duplicate' : 'processed';
    await logWebhookEvent({
      source: 'paystack',
      reference,
      eventType: event.event,
      payload: event,
      signatureOk: true,
      status: logStatus,
      note: isDuplicate ? 'Duplicate VA payment' : `Credited ₦${amount} to user ${user.id} via VA`
    });

    if (!isDuplicate) {
      await createNotification(
        user.id,
        'PAYMENT',
        'Wallet Funded via Transfer',
        `Your wallet has been credited with ₦${amount.toLocaleString()} via bank transfer.`
      );
      console.log(`[VA Webhook] Successfully credited user ${user.id} with ₦${amount}`);
    }

    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('[VA Webhook] Error:', error.message);
    await logWebhookEvent({
      source: 'paystack',
      reference: event?.data?.reference,
      eventType: event?.event,
      payload: event,
      signatureOk: true,
      status: 'error',
      note: `VA processing error: ${error.message}`
    });
    return res.status(500).send('Internal Error');
  }
};

/**
 * Flutterwave Webhook handler.
 */
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

    let user = null;
    let userId = null;

    // UUID v4 validation regex
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // 1. Try tx_ref format VA-<UUID>-<timestamp>
    if (reference && reference.startsWith('VA-')) {
      const prefixRemoved = reference.replace('VA-', '');
      const lastHyphenIndex = prefixRemoved.lastIndexOf('-');
      if (lastHyphenIndex !== -1) {
        const potentialId = prefixRemoved.substring(0, lastHyphenIndex);
        if (UUID_REGEX.test(potentialId)) {
          const { rows: txRefUsers } = await query(
            `SELECT id FROM users WHERE id = $1`,
            [potentialId]
          );
          if (txRefUsers.length > 0) {
            user = txRefUsers[0];
            userId = user.id;
            console.log(`[Flutterwave Webhook VA] Matched user from tx_ref: ${userId}`);
          }
        }
      }
    }

    // 2. Try email lookup
    if (!userId && email) {
      const { rows: users } = await query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );
      user = users[0];
      if (user) userId = user.id;
    }

    // 3. Try virtual account number lookup
    if (!userId) {
      const accountNumber = 
        payload.data?.account?.account_number || 
        payload.account?.account_number || 
        payload.data?.account_number ||
        payload.account_number;
      
      if (accountNumber) {
        const { rows: vaRows } = await query(
          `SELECT id FROM users WHERE virtual_account_number = $1 LIMIT 1`,
          [accountNumber]
        );
        user = vaRows[0];
        if (user) userId = user.id;
      }
    }

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

    try {
      await logWebhookEvent({
        source: 'flutterwave',
        reference: req.body?.data?.tx_ref || req.body?.tx_ref || null,
        eventType: 'error',
        payload: req.body,
        signatureOk: false,
        status: 'error',
        note: `Error processing webhook: ${error.message}`
      });
    } catch (logErr) {
      console.error('[Flutterwave Webhook] Failed to log error:', logErr.message);
    }

    return res.status(500).send('Internal Server Error');
  }
};
