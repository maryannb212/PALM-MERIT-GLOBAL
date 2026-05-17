/**
 * transactionController.js
 *
 * Handles:
 *  - Payment initialisation  (POST /api/transactions/initialize)
 *  - Paystack webhook        (POST /api/transactions/webhook/paystack)
 *  - Manual verify callback  (GET  /api/transactions/verify/:reference)
 *  - User transaction list   (GET  /api/transactions/my-transactions)
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
    const email = req.user.email;
    const provider = payment_provider || 'paystack';

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
          const paystackRes = await axios.post('https://api.paystack.co/transaction/initialize', {
            email,
            amount: Math.round(Number(amount) * 100),
            reference,
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
          const redirect_url = `${baseUrl}/dashboard/wallet?ref=${reference}`;

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
 *
 * Security flow:
 *  1. Verify HMAC-SHA512 signature.
 *  2. Log the raw event.
 *  3. Verify with Paystack API (re-fetch the transaction for canonical data).
 *  4. Call processCompletedPayment() — idempotent, atomic, row-locked.
 *  5. Send notification on first successful processing.
 *  6. Always return 200 so Paystack stops retrying (even for duplicates).
 */
export const paystackWebhook = async (req, res) => {
  const secret = getPaystackSecret();

  // express.raw() gives us a Buffer; express.json() gives a parsed object.
  // Support both so this works even if middleware changes.
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

  // ── 1. Signature verification ─────────────────────────────────────────────
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
    // Mock / dev mode — skip signature check but flag it
    signatureOk = true;
  }

  // ── 2. Log inbound event ──────────────────────────────────────────────────
  console.info(`[Webhook] Received event=${eventType} reference=${reference}`);

  // ── 3. Only handle charge.success ─────────────────────────────────────────
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

  // Validate required fields
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
    // ── 4. Re-verify with Paystack API for canonical amount ─────────────────
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
        // Return 200 to prevent Paystack from retrying an unresolvable error;
        // the idempotency guard will protect us if it fires again.
        return res.status(200).send('Verification error — will not retry');
      }
    }

    // ── 5. Idempotent atomic processing ─────────────────────────────────────
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
      // Return 200 so Paystack stops retrying
      return res.status(200).send('Duplicate webhook — already processed');
    }

    // ── 6. Success path ──────────────────────────────────────────────────────
    await logWebhookEvent({
      source: 'paystack',
      reference,
      eventType,
      payload: event,
      signatureOk,
      status: 'processed',
      note: `Credited ${transaction.amount} NGN to user ${transaction.user_id}`,
    });

    // Fire-and-forget notification (don't let it block the 200 response)
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
    // Return 200 to prevent infinite Paystack retries on hard errors
    return res.status(200).send('Internal error — logged');
  }
};

/**
 * Flutterwave Webhook handler.
 */
export const flutterwaveWebhook = async (req, res) => {
  const secret = getFlutterwaveSecret();
  const signature = req.headers['verif-hash'];

  // 1. Signature Verification
  if (!isMockMode() && process.env.FLUTTERWAVE_WEBHOOK_HASH) {
    if (signature !== process.env.FLUTTERWAVE_WEBHOOK_HASH) {
      return res.status(401).send('Unauthorized');
    }
  }

  const payload = req.body;
  const reference = payload.tx_ref || payload.data?.tx_ref;
  const transactionId = payload.id || payload.data?.id;

  if (payload.status !== 'successful' && payload.data?.status !== 'successful') {
    return res.status(200).send('Transaction not successful');
  }

  try {
    // 2. Re-verify with Flutterwave API
    let verifiedAmount = null;
    let gatewayRef = null;

    if (!isMockMode()) {
      const verified = await verifyWithFlutterwave(transactionId, secret);
      verifiedAmount = verified.amount;
      gatewayRef = verified.gatewayRef;
    }

    // 3. Process
    const { isDuplicate, transaction } = await processCompletedPayment(reference, verifiedAmount, gatewayRef, 'flutterwave');

    if (!isDuplicate) {
      createNotification(transaction.user_id, 'PAYMENT', 'Payment Successful', `Your Flutterwave payment of ₦${Number(transaction.amount).toLocaleString()} was successful.`).catch(() => {});
    }

    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('[Flutterwave Webhook] Error:', error.message);
    return res.status(200).send('Error logged');
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
