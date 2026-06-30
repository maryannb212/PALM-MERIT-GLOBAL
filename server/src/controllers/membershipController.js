import { createTransaction, processCompletedPayment } from '../models/transactionModel.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import dotenv from 'dotenv';
import { query } from '../config/db.js';

dotenv.config();

function getLotusMerchantKey() {
  return process.env.LOTUS_MERCHANT_KEY || '';
}

function getLotusWalletId() {
  return process.env.LOTUS_WALLET_ID || 'master';
}

/**
 * Initialize membership payment
 * POST /api/membership/initialize
 * Accepts payment_provider: 'paystack' (default) or 'lotus'
 */
export const initializeMembershipPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = 500; // Registration fee
    const provider = req.body.payment_provider || 'paystack';
    const email = req.user.email || `user${userId}@palmmeritglobal.com`;

    const reference = `PM-MEM-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create pending transaction in our DB with the correct payment provider
    const transaction = await createTransaction(userId, null, 'membership', amount, reference, provider);

    const isMockMode = () => process.env.PAYMENT_MODE === 'mock';
    if (isMockMode()) {
      return res.status(201).json({ message: 'Membership payment initialized (mock)', transaction, authorization_url: null });
    }

    const baseUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || process.env.WEBHOOK_BASE_URL || 'https://palmmeritglobal.com').replace(/\/$/, '');

    let authorization_url = null;

    if (provider === 'lotus') {
      const merchantKey = getLotusMerchantKey();
      if (!merchantKey) {
        throw new Error('Lotus Bank is not configured. Please contact support.');
      }

      const returnUrl = `${baseUrl}/verify-deposit?trxref=${reference}`;

      const lotusRes = await axios.post('https://partnerhub.lotusbank.com/api/v1/checkout/initialize', {
        amount,
        currency: 'NGN',
        returnUrl,
        walletId: getLotusWalletId(),
        metadata: { userId, type: 'membership', reference }
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
    } else {
      // Default: Paystack
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) {
        throw new Error('Paystack is not configured. Please contact support.');
      }

      const paystackData = {
        email,
        amount: amount * 100,
        reference,
        callback_url: `${baseUrl}/verify-membership`,
        metadata: {
          userId,
          type: 'membership'
        }
      };

      const response = await axios.post('https://api.paystack.co/transaction/initialize', paystackData, {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      });

      authorization_url = response.data.data.authorization_url;
    }

    res.status(201).json({
      message: 'Membership payment initialized',
      transaction,
      authorization_url
    });
  } catch (error) {
    console.error('Error in initializeMembershipPayment:', error);
    res.status(500).json({ message: 'Server error during membership payment initialization' });
  }
};

/**
 * Verify membership payment
 * GET /api/membership/verify/:reference
 */
export const verifyMembershipPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (process.env.PAYMENT_MODE === 'mock') {
      const { transaction } = await processCompletedPayment(reference);
      return res.json({
        message: 'Membership payment verified (mock). You now have access to the dashboard.',
        transaction
      });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` }
    });
    
    const data = response.data.data;
    if (data.status === 'success') {
      const { transaction } = await processCompletedPayment(reference, data.amount / 100);
      return res.json({
        message: 'Membership payment verified. You now have access to the dashboard.',
        transaction
      });
    } else {
      return res.status(400).json({ message: `Payment is still ${data.status}` });
    }
  } catch (error) {
    console.error('Error in verifyMembershipPayment:', error);
    res.status(500).json({ message: 'Server error during membership verification' });
  }
};

/**
 * Upload membership payment receipt (Manual Transfer)
 * POST /api/membership/upload-receipt
 */
export const uploadMembershipReceipt = async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = 500; // Registration fee
    
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a payment receipt' });
    }

    const reference = `PM-MEM-MAN-${uuidv4().substring(0, 8).toUpperCase()}`;
    
    // In production (Cloudinary), 'path' is the full URL.
    const receiptUrl = process.env.NODE_ENV === 'production' 
      ? req.file.path 
      : `/uploads/${req.file.filename}`;

    // Create pending transaction in our DB with receipt URL
    const text = `
      INSERT INTO transactions (user_id, type, amount, reference, status, receipt_url)
      VALUES ($1, 'membership', $2, $3, 'pending', $4)
      RETURNING *;
    `;
    const values = [userId, amount, reference, receiptUrl];
    const { rows } = await query(text, values);

    res.status(201).json({
      message: 'Receipt uploaded successfully. Admin will verify it shortly.',
      transaction: rows[0]
    });
  } catch (error) {
    console.error('Error in uploadMembershipReceipt:', error);
    res.status(500).json({ message: 'Server error during receipt upload' });
  }
};
