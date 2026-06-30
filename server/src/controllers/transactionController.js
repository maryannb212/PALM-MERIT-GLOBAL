/**
 * transactionController.js
 *
 * Handles:
 *  - Payment initialisation  (POST /api/transactions/initialize)
 *  - Paystack webhook        (POST /api/transactions/webhook/paystack)
 *  - Lotus webhook           (POST /api/transactions/webhook/lotus)
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

const cleanKey = (key) => (process.env[key] || '').trim().replace(/^["']|["']$/g, '') || '';

const getPaystackSecret = () => cleanKey('PAYSTACK_SECRET_KEY');
const getLotusMerchantKey = () => cleanKey('LOTUS_MERCHANT_KEY');
const getLotusXApiKey = () => cleanKey('LOTUS_X_API_KEY');
const getLotusWalletId = () => cleanKey('LOTUS_WALLET_ID');

if (process.env.NODE_ENV === 'production') {
  const ps = getPaystackSecret();
  console.log(`[Payment] Provider Keys - Paystack: ${ps.substring(0, 8)}...`);
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transactions/initialize
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a transaction (deposit, membership, etc.)
 * POST /api/transactions/initialize
 */
export const initializeTransaction = async (req, res) => {
  try {
    const { amount, planId, type, payment_provider, defaultId, accountIndex } = req.body;
    const userId = req.user.id;
    // Fallback email for users who registered without one — payment gateways require a valid email
    const email = req.user.email || `user${userId}@palmmeritglobal.com`;
    const provider = payment_provider || 'lotus';

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

    let reference;
    if (defaultId) {
      const shortRandom = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
      reference = `PM-DFT@@${defaultId}@@${shortRandom}`;
    } else if (type === 'clearance' && planId) {
      const shortRandom = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
      const ai = typeof accountIndex === 'number' ? accountIndex : 'ALL';
      reference = `PM-CLR@@${ai}@@${shortRandom}`;
    } else {
      reference = `PM-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    }

    // Create pending record
    const transaction = await createTransaction(userId, planId || null, type || 'deposit', Number(amount), reference, provider);

    let authorization_url = null;

    if (isMockMode()) {
      return res.status(201).json({ message: 'Transaction initialized (mock)', transaction, authorization_url: null });
    }

    if (provider === 'paystack') {
      try {
        const baseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.WEBHOOK_BASE_URL || 'https://palmmeritglobal.com').replace(/\/$/, '');
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
    } else if (provider === 'lotus') {
      const merchantKey = getLotusMerchantKey();
      if (!merchantKey) {
        throw new Error('Lotus Bank is not configured. Please contact support.');
      }
      try {
        const baseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.WEBHOOK_BASE_URL || 'https://palmmeritglobal.com').replace(/\/$/, '');
        const returnUrl = `${baseUrl}/verify-deposit?trxref=${reference}`;

        const lotusRes = await axios.post('https://partnerhub.lotusbank.com/api/v1/checkout/initialize', {
          amount: Math.round(Number(amount)),
          currency: 'NGN',
          returnUrl,
          walletId: getLotusWalletId() || 'master',
          metadata: { userId, planId, type, reference }
        }, {
          headers: { 
            Authorization: merchantKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        authorization_url = lotusRes.data?.data?.authorization_url;
        if (!authorization_url) {
          throw new Error('Lotus Bank did not return an authorization_url');
        }
      } catch (error) {
        console.error('[initializeTransaction] Lotus Error:', error.response?.data || error.message);
        throw error;
      }
    } else {
      throw new Error(`Unsupported payment provider: ${provider}`);
    }

    if (!authorization_url) {
      throw new Error('Failed to initialize payment. No authorization URL returned.');
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
    console.error('[Paystack Webhook] Error:', error.message);
    await logWebhookEvent({
      source: 'paystack',
      reference: event?.data?.reference || null,
      eventType: event?.event,
      payload: event,
      signatureOk: true,
      status: 'error',
      note: error.message
    });
    return res.status(500).send('Internal Error');
  }
};

export const lotusWebhook = async (req, res) => {
  try {
    // Dual-mode raw body handling (works with or without express.raw middleware)
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : JSON.stringify(req.body);

    let payload;
    try {
      payload = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
    } catch {
      return res.status(400).send('Invalid JSON payload');
    }

    const payloadService = payload.service || '';
    const payloadType = payload.type || '';
    const eventType = payload.event || payloadType || 'unknown';
    const reference = payload.data?.reference || payload.reference || null;
    const status = payload.data?.status || payload.status || '';

    console.log('============== LOTUS WEBHOOK ==============');
    console.log(JSON.stringify(payload, null, 2));

   
    const apiKey = getLotusXApiKey();
    const signatureHeader = req.headers['signature'];
    let signatureOk = false;
    if (apiKey && signatureHeader) {
      const hash = crypto.createHmac('sha512', apiKey).update(rawBody).digest('hex');
      signatureOk = hash === signatureHeader;
    }
    if (!signatureOk) {
      console.warn('[Lotus Webhook] Invalid HMAC signature');
      await logWebhookEvent({
        source: 'lotus',
        reference,
        eventType,
        payload,
        signatureOk: false,
        status: 'rejected',
        note: 'HMAC signature mismatch'
      });
      return res.status(401).send('Unauthorized');
    }

    // ── Fund Transfer (merchant settlement, no user VA info) ────────────
    if (payloadService === 'payments' && payloadType === 'fund_transfer') {
      console.info(`[Lotus Webhook] Fund transfer acknowledged — ref=${payload.data?.transactionReference || 'none'}`);
      await logWebhookEvent({
        source: 'lotus',
        reference: payload.data?.transactionReference || null,
        eventType,
        payload,
        signatureOk: true,
        status: 'acknowledged',
        note: 'Merchant fund transfer — no user action needed'
      });
      return res.status(200).send('Acknowledged');
    }

    // ── Virtual Account (Reserved Account) Deposit ────────────────────────
    if (payloadService === 'payments' && payloadType === 'reserved_account') {
      return await handleLotusVADeposit(payload, res);
    }

    // ── Checkout Payment (membership, deposit, etc.) ────────────────────
    const isSuccessfulCheckout = payload.event === 'payment.success' ||
      payloadType === 'checkout' ||
      (payload.service === 'payment' && payload.data?.status === 'successful');
    if (isSuccessfulCheckout && reference) {
      return await handleLotusCheckout(payload, res);
    }

    if (!reference) {
      await logWebhookEvent({
        source: 'lotus',
        reference: null,
        eventType,
        payload,
        signatureOk: true,
        status: 'acknowledged',
        note: 'Unknown event type or missing reference — acknowledged'
      });
      return res.status(200).send('Acknowledged');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Detect payment type:
    // Virtual Account (bank transfer) → payload.data.reserved_account exists
    // Checkout (card/transfer via checkout link) → no reserved_account
    // ─────────────────────────────────────────────────────────────────────────
    const isVirtualAccountPayment = !!(payload.data?.reserved_account);

    if (isVirtualAccountPayment) {
      // ── VIRTUAL ACCOUNT PAYMENT FLOW ──────────────────────────────────────
      // HMAC already verified above — no secondary API call needed.
      // Lotus VA webhook always fires on a successful transfer, so we trust
      // the payload directly and credit the user by their virtual_account_number.

      const rawAmount = payload.data?.amount || 0;
      // Lotus sends VA amounts in naira (not kobo), unlike Paystack
      const amount = Number(rawAmount);
      const accountNumber = payload.data?.reserved_account?.account_details?.account_number;

      if (!accountNumber) {
        await logWebhookEvent({
          source: 'lotus',
          reference,
          eventType,
          payload,
          signatureOk: true,
          status: 'rejected',
          note: 'VA webhook missing reserved_account.account_details.account_number'
        });
        return res.status(400).send('Missing account number');
      }

      if (!amount || amount <= 0) {
        await logWebhookEvent({
          source: 'lotus',
          reference,
          eventType,
          payload,
          signatureOk: true,
          status: 'rejected',
          note: `Invalid amount: ${rawAmount}`
        });
        return res.status(400).send('Invalid amount');
      }

      // Look up user by virtual account number
      const { rows: userRows } = await query(
        'SELECT id, email, available_balance FROM users WHERE virtual_account_number = $1',
        [accountNumber]
      );

      if (!userRows[0]) {
        console.error(`[Lotus VA Webhook] No user found for account ${accountNumber}`);
        await logWebhookEvent({
          source: 'lotus',
          reference,
          eventType,
          payload,
          signatureOk: true,
          status: 'error',
          note: `No user found for virtual_account_number=${accountNumber}`
        });
        return res.status(200).send('User not found');
      }

      const user = userRows[0];

      // Check for duplicate (idempotency)
      const { rows: existingTx } = await query(
        'SELECT id, status FROM transactions WHERE reference = $1',
        [reference]
      );

      if (existingTx[0]?.status === 'completed') {
        console.info(`[Lotus VA Webhook] Duplicate — already processed ref=${reference}`);
        await logWebhookEvent({
          source: 'lotus',
          reference,
          eventType,
          payload,
          signatureOk: true,
          status: 'duplicate',
          note: 'Already processed'
        });
        return res.status(200).send('Duplicate');
      }

      // Create a pending transaction record if none exists (VA payments have no prior record)
      if (!existingTx[0]) {
        await query(
          `INSERT INTO transactions (user_id, plan_id, type, amount, reference, payment_provider, status)
           VALUES ($1, NULL, 'wallet_topup', $2, $3, 'lotus', 'pending')
           ON CONFLICT (reference) DO NOTHING`,
          [user.id, amount, reference]
        );
      }

      // Process the payment (idempotent)
      const { isDuplicate, transaction } = await processCompletedPayment(
        reference,
        amount,
        reference,
        'lotus'
      );

      if (isDuplicate) {
        console.info(`[Lotus VA Webhook] Duplicate — already processed ref=${reference}`);
        await logWebhookEvent({
          source: 'lotus',
          reference,
          eventType,
          payload,
          signatureOk: true,
          status: 'duplicate',
          note: 'Already processed'
        });
        return res.status(200).send('Duplicate');
      }

      await createNotification(
        transaction.user_id,
        'PAYMENT',
        'Payment Successful (Lotus Bank)',
        `Your Lotus Bank payment of ₦${Number(transaction.amount).toLocaleString('en-NG')} (ref: ${reference}) has been confirmed.`
      ).catch(() => {});

      await logWebhookEvent({
        source: 'lotus',
        reference,
        eventType,
        payload,
        signatureOk: true,
        status: 'processed',
        note: `Credited ₦${transaction.amount} to user ${transaction.user_id}`
      });

      console.info(`[Lotus Webhook] Processed reference=${reference}`);
      return res.status(200).send('Webhook processed');
    }
    // If not a virtual account payment, respond success (events we don't handle)
    return res.status(200).send('Not a VA payment');
  } catch (error) {
    console.error('[Lotus Webhook] Error:', error.message);
    await logWebhookEvent({
      source: 'lotus',
      reference: req.body?.reference || null,
      eventType: 'error',
      payload: req.body,
      signatureOk: true,
      status: 'error',
      note: error.message
    }).catch(() => {});
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
    } else if (provider === 'lotus') {
      const lotusRef = req.query.lotusRef;
      const lookupRef = lotusRef || reference;
      const statusRes = await axios.get(`https://partnerhub.lotusbank.com/api/v1/checkout/status/${lookupRef}`, {
        headers: { 'x-api-key': getLotusXApiKey() }
      });
      const data = statusRes.data?.data;
      if (!data) throw new Error('Empty Lotus verification response');
      const successStatuses = ['successful', 'completed', 'paid', 'success', 'approved', 'succeeded'];
      if (!successStatuses.includes((data.status || '').toLowerCase())) {
        throw new Error(`Lotus payment status is '${data.status}'`);
      }
      verifiedAmount = data.amount;
      gatewayRef = data.reference || lookupRef;
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

// ─────────────────────────────────────────────────────────────────────────────
// Lotus Virtual Account (Reserved Account) Deposit Webhook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle Lotus virtual account deposit webhook.
 * Called from lotusWebhook when service='payments' and type='reserved_account'.
 */
async function handleLotusVADeposit(payload, res) {
  try {
    const data = payload.data || {};
    const accountNumber = data.reserved_account?.account_details?.account_number || data.reserved_account?.account_number;
    const amount = parseFloat(data.amount) || 0;
    const vaReference = data.reference || '';

    if (!accountNumber) {
      console.warn('[Lotus VA Webhook] Missing account_number');
      await logWebhookEvent({
        source: 'lotus', reference: vaReference, eventType: 'reserved_account',
        payload, signatureOk: true, status: 'rejected',
        note: 'Missing account_number in reserved_account webhook'
      });
      return res.status(400).send('Missing account_number');
    }

    if (amount <= 0) {
      console.warn('[Lotus VA Webhook] Invalid amount:', amount);
      return res.status(200).send('Ignored — invalid amount');
    }

    if (!vaReference) {
      console.warn('[Lotus VA Webhook] Missing reference in payload');
      await logWebhookEvent({
        source: 'lotus', reference: null, eventType: 'reserved_account',
        payload, signatureOk: true, status: 'rejected',
        note: 'Missing reference in reserved_account webhook for VA deposit'
      });
      return res.status(400).send('Missing reference');
    }

    // Find user by virtual account number
    const { rows } = await query(
      'SELECT id, email, virtual_account_number FROM users WHERE virtual_account_number = $1',
      [accountNumber]
    );
    const user = rows[0];

    if (!user) {
      console.warn(`[Lotus VA Webhook] No user found for account ${accountNumber}`);
      await logWebhookEvent({
        source: 'lotus', reference: vaReference, eventType: 'reserved_account',
        payload, signatureOk: true, status: 'rejected',
        note: `No user found for VA account ${accountNumber}`
      });
      return res.status(200).send('User not found');
    }

    // Check for duplicate
    const { rows: existingTx } = await query(
      'SELECT * FROM transactions WHERE reference = $1',
      [vaReference]
    );

    if (existingTx.length === 0) {
      await createTransaction(
        user.id, null, 'wallet_topup', amount, vaReference, 'lotus'
      );
    }

    const { isDuplicate } = await processCompletedPayment(
      vaReference, amount, vaReference, 'lotus'
    );

    await logWebhookEvent({
      source: 'lotus', reference: vaReference, eventType: 'reserved_account',
      payload, signatureOk: true,
      status: isDuplicate ? 'duplicate' : 'processed',
      note: isDuplicate
        ? `Duplicate VA deposit for user ${user.id}`
        : `Credited ₦${amount} to user ${user.id} via Lotus VA deposit`
    });

    if (!isDuplicate) {
      await createNotification(
        user.id, 'PAYMENT', 'Wallet Funded via Transfer',
        `Your wallet has been credited with ₦${amount.toLocaleString('en-NG')} via bank transfer to your Lotus virtual account.`
      ).catch(() => {});
      console.log(`[Lotus VA Webhook] Credited user ${user.id} with ₦${amount}`);
    }

    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('[Lotus VA Webhook] Error:', error.message);
    await logWebhookEvent({
      source: 'lotus', reference: payload?.data?.reference || null,
      eventType: 'reserved_account', payload,
      signatureOk: true, status: 'error', note: error.message
    }).catch(() => {});
    return res.status(200).send('Error logged');
  }
}

/**
 * Handle Lotus checkout payment webhook (membership, deposit, etc.)
 * Called from lotusWebhook for successful checkout/payment events.
 */
async function handleLotusCheckout(payload, res) {
  try {
    const data = payload.data || {};
    const reference = data.reference || payload.reference || '';
    const status = data.status || payload.status || '';

    if (!reference) {
      console.warn('[Lotus Checkout Webhook] Missing reference');
      return res.status(200).send('Missing reference');
    }

    const successStatuses = ['successful', 'completed', 'paid', 'success', 'approved', 'succeeded'];
    if (!successStatuses.includes(status.toLowerCase())) {
      console.info(`[Lotus Checkout Webhook] Non-success status: ${status}`);
      return res.status(200).send(`Ignored — status: ${status}`);
    }

    // Find the pending transaction
    const { rows: existingTx } = await query(
      'SELECT * FROM transactions WHERE reference = $1',
      [reference]
    );

    if (existingTx.length === 0) {
      console.warn(`[Lotus Checkout Webhook] No transaction found for ref=${reference}`);
      await logWebhookEvent({
        source: 'lotus', reference, eventType: 'checkout',
        payload, signatureOk: true, status: 'rejected',
        note: `No transaction found for ref ${reference}`
      });
      return res.status(200).send('Transaction not found');
    }

    if (existingTx[0].status === 'completed') {
      console.info(`[Lotus Checkout Webhook] Already completed ref=${reference}`);
      await logWebhookEvent({
        source: 'lotus', reference, eventType: 'checkout',
        payload, signatureOk: true, status: 'duplicate',
        note: 'Already processed'
      });
      return res.status(200).send('Duplicate');
    }

    const amount = parseFloat(data.amount) || parseFloat(existingTx[0].amount) || 0;

    const { isDuplicate, transaction } = await processCompletedPayment(
      reference, amount, reference, 'lotus'
    );

    const txType = transaction.type || existingTx[0].type;
    const userId = transaction.user_id || existingTx[0].user_id;

    await logWebhookEvent({
      source: 'lotus', reference, eventType: 'checkout',
      payload, signatureOk: true,
      status: isDuplicate ? 'duplicate' : 'processed',
      note: isDuplicate
        ? `Duplicate checkout for ref ${reference}`
        : `Processed ${txType} of ₦${amount} for user ${userId}`
    });

    if (!isDuplicate) {
      const label = txType === 'membership' ? 'Membership Activated' : 'Payment Successful';
      const msg = txType === 'membership'
        ? 'Your membership has been activated successfully.'
        : `Your payment of ₦${amount.toLocaleString('en-NG')} (ref: ${reference}) has been confirmed.`;
      await createNotification(userId, 'PAYMENT', label, msg).catch(() => {});
      console.log(`[Lotus Checkout Webhook] Processed ${txType} for user ${userId}`);
    }

    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('[Lotus Checkout Webhook] Error:', error.message);
    await logWebhookEvent({
      source: 'lotus', reference: payload?.data?.reference || null,
      eventType: 'checkout', payload,
      signatureOk: true, status: 'error', note: error.message
    }).catch(() => {});
    return res.status(200).send('Error logged');
  }
}
