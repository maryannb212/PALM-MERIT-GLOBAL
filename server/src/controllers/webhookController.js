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


