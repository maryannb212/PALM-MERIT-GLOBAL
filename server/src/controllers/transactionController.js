/**
 * transactionController.js
 *
 * Handles:
 *  - Payment initialisation  (POST /api/transactions/initialize)
 *  - Paystack webhook        (POST /api/transactions/webhook/paystack)
 *  - Flutterwave webhook     (POST /api/transactions/webhook/flutterwave)
 *  - Manual verify callback  (GET  /api/transactions/verify/:reference)
 *  - User transaction list   (GET  /api/transactions/my-transactions)
 *  - Upload manual payment receipt (POST /api/transactions/upload-receipt)
 *
 * IDEMPOTENCY GUARANTEE:
 *  Every payment path funnels through processCompletedPayment() in
 *  transactionModel.js, which uses a SELECT … FOR UPDATE row lock to
 *  guarantee a reference is credited exactly once even under concurrent
 *  webhook retries or user double-clicks.
 */

import {
  createTransaction,
  processCompletedPayment,
  updateTransactionStatus,
  getUserTransactions,
  getTransactionByReference,
} from '../models/transactionModel.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createNotification } from '../models/notificationModel.js';
import { logWebhookEvent } from '../utils/webhookLogger.js';
import { query } from '../config/db.js';

dotenv.config();

const cleanKey = (key) => process.env[key]?.trim().replace(/^["']|["']$/g, '') || '';

const getPaystackSecret = () => cleanKey('PAYSTACK_SECRET_KEY');
const getFlutterwaveSecret = () => cleanKey('FLUTTERWAVE_SECRET_KEY');

if (process.env.NODE_ENV === 'production') {
  const flw = getFlutterwaveSecret();
  const ps = getPaystackSecret();
  console.log(`[Payment] Provider Keys - Flutterwave: ${flw.substring(0, 8)}..., Paystack: ${ps.substring(0, 8)}...`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const isMockMode = () => process.env.PAYMENT_MODE === 'mock';

/**
 * Verify a transaction reference with the Paystack API.
 */
const verifyWithPaystack = async (reference, secret) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      timeout: 10_000,
    }
  );

  const data = response.data?.data;
  if (!data) throw new Error('Empty Paystack verify response');
  if (data.status !== 'success') throw new Error(`Paystack status is '${data.status}'`);

  return {
    success: true,
    amount: data.amount / 100, // kobo → NGN
    gatewayRef: data.id?.toString() || null,
  };
};

/**
 * Verify a transaction with Flutterwave API.
 */
const verifyWithFlutterwave = async (transactionId, secret) => {
  const response = await axios.get(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      timeout: 10_000,
    }
  );

  const data = response.data?.data;
  if (!data) throw new Error('Empty Flutterwave verify response');
  if (data.status !== 'successful') throw new Error(`Flutterwave status is '${data.status}'`);

  return {
    success: true,
    amount: data.amount,
    gatewayRef: data.id?.toString() || null,
    reference: data.tx_ref,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/initialize
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a transaction (deposit, membership, etc.)
 * POST /api/transactions/initialize
 */
export const initializeTransaction = async (req, res) => {
  try {
    const { amount, planId, type, payment_provider } = req.body;
    const userId = req.user.id;
    // Fallback email for users who registered without one — payment gateways require a valid email
    const email = req.user.email || `user${userId}@palmmeritglobal.com`;
    const provider = payment_provider || 'flutterwave';

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'A valid positive amount is required.' });
    }

    // Savings Schedule Enforcement Validation
    if (planId) {
      const { rows: planRows } = await query('SELECT * FROM savings_plans WHERE id = $1', [planId]);
      if (planRows.length > 0) {
        const plan = planRows[0];
        if (plan.preferred_day) {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const todayName = days[new Date().getDay()];
          if (todayName.toLowerCase() !== plan.preferred_day.toLowerCase()) {
            return res.status(400).json({
              message: `Contribution Restricted: You can only add funds to this Cooperative Program on your selected preferred day: ${plan.preferred_day}. (Today is ${todayName})`
            });
          }
        }
      }
    }

    const reference = `PM-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;

    // Create pending record
    const transaction = await createTransaction(userId, planId || null, type || 'deposit', Number(amount), reference, provider);

    let authorization_url = `https://mock-payment-gateway.com/pay/${reference}`;

    if (!isMockMode()) {
      if (provider === 'paystack') {
        try {
          const baseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://palmmeritglobal.com').replace(/\/$/, '');
          const callback_url = `${baseUrl}/verify-deposit?reference=${reference}`;

          const paystackRes = await axios.post('https://api.paystack.co/transaction/initialize', {
            email,
            amount: Math.round(Number(amount) * 100),
            reference,
            callback_url,
            metadata: { userId, planId, type }
          }, {
            headers: { 
              Authorization: `Bearer ${getPaystackSecret()}`,
              'Content-Type': 'application/json'
            }
          });
          authorization_url = paystackRes.data.data.authorization_url;
        } catch (error) {
          console.error('[initializeTransaction] Paystack Error:', error.response?.data || error.message);
          throw error;
        }
      } else if (provider === 'flutterwave') {
        try {
          const baseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://palmmeritglobal.com').replace(/\/$/, '');
          const redirect_url = `${baseUrl}/verify-deposit?reference=${reference}`;

          const flutterwaveRes = await axios.post('https://api.flutterwave.com/v3/payments', {
            tx_ref: reference,
            amount: Number(amount),
            currency: 'NGN',
            redirect_url,
            customer: { 
              email, 
              name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
              phone_number: req.user.phone || ''
            },
            customizations: { 
              title: 'Palm Merit Global', 
              description: `Payment for ${type || 'deposit'}`,
              logo: 'https://palmmeritglobal.com/logo.png' 
            },
            payment_options: 'card,account,ussd,banktransfer'
          }, {
            headers: { 
              Authorization: `Bearer ${getFlutterwaveSecret()}`,
              'Content-Type': 'application/json'
            }
          });
          authorization_url = flutterwaveRes.data.data.link;
        } catch (error) {
          console.error('[initializeTransaction] Flutterwave Error:', error.response?.data || error.message);
          throw error;
        }
      }
    }

    return res.status(201).json({ message: 'Transaction initialized', transaction, authorization_url });
  } catch (error) {
    const errorData = error.response?.data || {};
    const errorMessage = errorData.message || error.message;
    console.error('[initializeTransaction] Global Catch:', errorMessage);
    
    return res.status(500).json({ 
      message: 'Could not initialize payment. Please try again.',
      error: process.env.NODE_ENV === 'production' ? null : errorMessage
    });
  }
};

// Alias for backward compatibility
export const initializeDeposit = initializeTransaction;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/webhook/paystack
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paystack Webhook handler.
 */
export const paystackWebhook = async (req, res) => {
  const secret = getPaystackSecret();

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf8')
    : JSON.stringify(req.body);

  let event;
  try {
    event = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
  } catch {
    return res.status(400).send('Invalid JSON payload');
  }

  const eventType = event?.event || 'unknown';
  const reference = event?.data?.reference || null;

  let signatureOk = false;
  if (secret && !isMockMode()) {
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    signatureOk = hash === req.headers['x-paystack-signature'];

    if (!signatureOk) {
      console.warn(`[Webhook] Invalid signature for reference=${reference}`);
      await logWebhookEvent({
        source: 'paystack',
        reference,
        eventType,
        payload: event,
        signatureOk: false,
        status: 'rejected',
        note: 'HMAC signature mismatch',
      });
      return res.status(400).send('Invalid signature');
    }
  } else {
    signatureOk = true;
  }

  console.info(`[Webhook] Received event=${eventType} reference=${reference}`);

  if (eventType !== 'charge.success') {
    await logWebhookEvent({
      source: 'paystack',
      reference,
      eventType,
      payload: event,
      signatureOk,
      status: 'received',
      note: `Unhandled event type: ${eventType}`,
    });
    return res.status(200).send('Event acknowledged');
  }

  if (!reference) {
    await logWebhookEvent({
      source: 'paystack',
      reference: null,
      eventType,
      payload: event,
      signatureOk,
      status: 'rejected',
      note: 'Missing reference in webhook payload',
    });
    return res.status(400).send('Missing reference');
  }

  try {
    let verifiedAmount = null;
    let gatewayRef = null;

    if (!isMockMode()) {
      try {
        const verified = await verifyWithPaystack(reference, secret);
        verifiedAmount = verified.amount;
        gatewayRef = verified.gatewayRef;
      } catch (verifyErr) {
        console.error(`[Webhook] Paystack re-verify failed for ${reference}:`, verifyErr.message);
        await logWebhookEvent({
          source: 'paystack',
          reference,
          eventType,
          payload: event,
          signatureOk,
          status: 'error',
          note: `Re-verify failed: ${verifyErr.message}`,
        });
        return res.status(200).send('Verification error — will not retry');
      }
    }

    const { isDuplicate, transaction } = await processCompletedPayment(
      reference,
      verifiedAmount,
      gatewayRef,
      'paystack'
    );

    if (isDuplicate) {
      console.info(`[Webhook] Duplicate — already processed reference=${reference}`);
      await logWebhookEvent({
        source: 'paystack',
        reference,
        eventType,
        payload: event,
        signatureOk,
        status: 'duplicate',
        note: 'Reference already completed — no action taken',
      });
      return res.status(200).send('Duplicate webhook — already processed');
    }

    await logWebhookEvent({
      source: 'paystack',
      reference,
      eventType,
      payload: event,
      signatureOk,
      status: 'processed',
      note: `Credited ${transaction.amount} NGN to user ${transaction.user_id}`,
    });

    createNotification(
      transaction.user_id,
      'PAYMENT',
      'Payment Successful',
      `Your payment of ₦${Number(transaction.amount).toLocaleString('en-NG')} ` +
      `(ref: ${reference}) has been confirmed and your account credited.`
    ).catch((err) =>
      console.error('[Webhook] Notification error:', err.message)
    );

    console.info(`[Webhook] Processed reference=${reference} amount=${transaction.amount}`);
    return res.status(200).send('Webhook processed');
  } catch (error) {
    const note = error.message || 'Unknown error';

    await logWebhookEvent({
      source: 'paystack',
      reference,
      eventType,
      payload: event,
      signatureOk,
      status: 'error',
      note,
    });

    if (error.message?.startsWith('REFERENCE_NOT_FOUND')) {
      console.warn(`[Webhook] Unknown reference: ${reference}`);
      return res.status(200).send('Unknown reference — ignored');
    }

    if (error.message?.startsWith('AMOUNT_MISMATCH')) {
      console.error(`[Webhook] Amount mismatch: ${error.message}`);
      return res.status(200).send('Amount mismatch — transaction rejected');
    }

    console.error('[Webhook] Unexpected error:', error);
    return res.status(200).send('Internal error — logged');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/webhook/flutterwave
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flutterwave Webhook handler.
 */
export const flutterwaveWebhook = async (req, res) => {
  const secret = getFlutterwaveSecret();

  try {
    // =====================================================
    // GET WEBHOOK DATA
    // =====================================================

    const signature = req.headers['verif-hash'];
    const payload = req.body;

    console.log('============== FLUTTERWAVE WEBHOOK ==============');
    console.log(JSON.stringify(payload, null, 2));

    // =====================================================
    // VERIFY SIGNATURE
    // =====================================================

    if (
      !isMockMode() &&
      process.env.FLUTTERWAVE_WEBHOOK_HASH &&
      signature !== process.env.FLUTTERWAVE_WEBHOOK_HASH
    ) {
      console.warn('[Flutterwave Webhook] Invalid signature');

      await logWebhookEvent({
        source: 'flutterwave',
        reference: null,
        eventType: payload.event || 'webhook',
        payload,
        signatureOk: false,
        status: 'rejected',
        note: 'Invalid webhook signature'
      });

      return res.status(401).send('Unauthorized');
    }

    // =====================================================
    // EXTRACT PAYMENT DETAILS
    // =====================================================

    const transactionId = payload.id || payload.data?.id;
    const status = payload.status || payload.data?.status;
    const amount = Number(payload.amount) || Number(payload.data?.amount) || 0;
    const email = payload.customer?.email || payload.data?.customer?.email || null;
    const flwRef = payload.flw_ref || payload.data?.flw_ref || null;
    const txRef = payload.tx_ref || payload.data?.tx_ref || null;
    const reference = txRef || flwRef || `FLW-${Date.now()}`;

    console.log('REFERENCE:', reference);
    console.log('TRANSACTION ID:', transactionId);
    console.log('EMAIL:', email);
    console.log('STATUS:', status);
    console.log('AMOUNT:', amount);

    // =====================================================
    // ONLY PROCESS SUCCESSFUL PAYMENTS
    // =====================================================

    if (status !== 'successful') {
      console.log('[Flutterwave Webhook] Ignored non-successful payment');

      await logWebhookEvent({
        source: 'flutterwave',
        reference,
        eventType: payload.event || 'webhook',
        payload,
        signatureOk: true,
        status: 'ignored',
        note: `Transaction status: ${status}`
      });

      return res.status(200).send('Ignored');
    }

    // =====================================================
    // VERIFY PAYMENT WITH FLUTTERWAVE
    // =====================================================

    let verifiedAmount = amount;
    let gatewayRef = flwRef;

    if (!isMockMode()) {
      const verified = await verifyWithFlutterwave(transactionId, secret);
      verifiedAmount = Number(verified.amount);
      gatewayRef = verified.gatewayRef || flwRef;
    }

    console.log('VERIFIED AMOUNT:', verifiedAmount);

    // =====================================================
    // CHECK DUPLICATE TRANSACTION
    // =====================================================

    const { rows: existingTx } = await query(
      `
        SELECT *
        FROM transactions
        WHERE reference = $1
      `,
      [reference]
    );

    if (existingTx.length > 0) {
      console.log('[Flutterwave Webhook] Duplicate transaction');

      await logWebhookEvent({
        source: 'flutterwave',
        reference,
        eventType: payload.event || 'charge.completed',
        payload,
        signatureOk: true,
        status: 'duplicate',
        note: 'Duplicate transaction ignored'
      });

      return res.status(200).send('Duplicate transaction');
    }

    // =====================================================
    // FIND USER
    // =====================================================

    let userId = null;

    if (txRef && txRef.startsWith('VA-')) {
      const parts = txRef.split('-');
      if (parts.length >= 2) {
        userId = parts[1];
      }
    }

    if (!userId && email) {
      const { rows: userRows } = await query(
        `
          SELECT id
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email]
      );

      if (userRows.length > 0) {
        userId = userRows[0].id;
      }
    }

    // NEW: Fallback for Virtual Account bank transfers (where email/tx_ref might not match)
    if (!userId) {
      const accountNumber = 
        payload.data?.account?.account_number || 
        payload.account?.account_number || 
        payload.data?.account_number ||
        payload.account_number;
      
      if (accountNumber) {
        const { rows: vaRows } = await query(
          `
            SELECT id
            FROM users
            WHERE virtual_account_number = $1
            LIMIT 1
          `,
          [accountNumber]
        );
        if (vaRows.length > 0) {
          userId = vaRows[0].id;
          console.log(`[Flutterwave Webhook] Matched user via virtual account number: ${accountNumber}`);
        }
      }
    }

    // =====================================================
    // USER NOT FOUND
    // =====================================================

    if (!userId) {
      console.error('[Flutterwave Webhook] User not found');

      await logWebhookEvent({
        source: 'flutterwave',
        reference,
        eventType: payload.event || 'charge.completed',
        payload,
        signatureOk: true,
        status: 'error',
        note: 'User not found'
      });

      return res.status(200).send('User not found');
    }

    console.log('USER ID:', userId);

    // =====================================================
    // CREATE TRANSACTION
    // =====================================================

    await createTransaction(
      userId,
      null,
      'wallet_topup',
      verifiedAmount,
      reference,
      'flutterwave'
    );

    console.log('[Flutterwave Webhook] Transaction created');

    // =====================================================
    // CREDIT USER WALLET
    // =====================================================

    await processCompletedPayment(
      reference,
      verifiedAmount,
      gatewayRef,
      'flutterwave'
    );

    console.log('[Flutterwave Webhook] Wallet credited');

    // =====================================================
    // CREATE NOTIFICATION
    // =====================================================

    await createNotification(
      userId,
      'PAYMENT',
      'Payment Successful',
      `Your Flutterwave payment of ₦${Number(
        verifiedAmount
      ).toLocaleString()} was successful.`
    ).catch(() => {});

    // =====================================================
    // LOG SUCCESS
    // =====================================================

    await logWebhookEvent({
      source: 'flutterwave',
      reference,
      eventType: payload.event || 'charge.completed',
      payload,
      signatureOk: true,
      status: 'processed',
      note: `Wallet credited with ₦${verifiedAmount}`
    });

    return res.status(200).send('Webhook processed');

  } catch (error) {
    console.error('[Flutterwave Webhook] ERROR:', error);

    await logWebhookEvent({
      source: 'flutterwave',
      reference: req.body?.tx_ref || req.body?.data?.tx_ref || null,
      eventType: req.body?.event || 'charge.completed',
      payload: req.body,
      signatureOk: true,
      status: 'error',
      note: error.message
    });

    return res.status(500).send('Webhook error');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions/verify/:reference
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified verification endpoint.
 */
export const verifyTransaction = async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ message: 'Reference is required.' });

    const existing = await getTransactionByReference(reference);
    if (!existing) return res.status(404).json({ message: 'Transaction not found.' });

    if (existing.status === 'completed') {
      return res.json({ message: 'Transaction already completed.', transaction: existing, alreadyProcessed: true });
    }

    if (isMockMode()) {
      const { isDuplicate, transaction } = await processCompletedPayment(reference, existing.amount, null, existing.payment_provider);
      return res.json({ message: 'Verified (mock)', transaction, alreadyProcessed: isDuplicate });
    }

    const provider = existing.payment_provider || 'paystack';
    let verifiedAmount, gatewayRef;

    if (provider === 'paystack') {
      const verified = await verifyWithPaystack(reference, getPaystackSecret());
      verifiedAmount = verified.amount;
      gatewayRef = verified.gatewayRef;
    } else if (provider === 'flutterwave') {
      const response = await axios.get(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`, {
        headers: { Authorization: `Bearer ${getFlutterwaveSecret()}` }
      });
      const data = response.data.data;
      if (data.status !== 'successful') throw new Error('Payment not successful');
      verifiedAmount = data.amount;
      gatewayRef = data.id.toString();
    }

    const { isDuplicate, transaction } = await processCompletedPayment(reference, verifiedAmount, gatewayRef, provider);

    if (!isDuplicate) {
      createNotification(transaction.user_id, 'PAYMENT', 'Payment Successful', `Your payment of ₦${Number(transaction.amount).toLocaleString()} confirmed.`).catch(() => {});
    }

    return res.json({ message: 'Transaction verified', transaction, alreadyProcessed: isDuplicate });
  } catch (error) {
    console.error('[verifyTransaction] Error:', error.message);
    return res.status(400).json({ message: error.message || 'Verification failed' });
  }
};

// Alias for backward compatibility
export const verifyDeposit = verifyTransaction;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/transactions/my-transactions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return all transactions for the authenticated user.
 */
export const getMyTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await getUserTransactions(userId);
    return res.json(transactions);
  } catch (error) {
    console.error('[getMyTransactions] Error:', error);
    return res.status(500).json({ message: 'Server error fetching transactions.' });
  }
};

/**
 * Upload manual payment receipt (Deposit or Membership)
 * POST /api/transactions/upload-receipt
 */
export const uploadReceipt = async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = req.body.amount ? parseFloat(req.body.amount) : 0;
    const type = req.body.type || 'deposit';

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a payment receipt' });
    }

    const reference = 'PM-MAN-' + uuidv4().substring(0, 8).toUpperCase();

    const receiptUrl = process.env.NODE_ENV === 'production'
      ? req.file.path
      : '/uploads/' + req.file.filename;

    const text = 'INSERT INTO transactions (user_id, type, amount, reference, status, receipt_url) VALUES ($1, $2, $3, $4, \'pending\', $5) RETURNING *';
    const values = [userId, type, amount, reference, receiptUrl];
    const { rows } = await query(text, values);

    res.status(201).json({
      message: 'Receipt uploaded successfully. Admin will verify it shortly.',
      transaction: rows[0]
    });
  } catch (error) {
    console.error('Error in uploadReceipt:', error);
    res.status(500).json({ message: 'Server error during receipt upload' });
  }
};
