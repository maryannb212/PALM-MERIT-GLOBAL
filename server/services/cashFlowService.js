// server/services/cashFlowService.js

/**
 * Cash Flow Service
 * Handles real‑time cash‑flow aggregation, automatic transaction splitting,
 * and risk monitoring integration.
 *
 * The service is invoked from webhook processors after a transaction is
 * successfully marked "completed" via processCompletedPayment().
 */

import fs from 'fs';
import path from 'path';
import { getClient } from '../config/db.js';
import { query } from '../config/db.js';
import { createNotification } from '../models/notificationModel.js';

// Load split rules configuration (standard + future categories)
const splitRulesPath = path.resolve(
  __dirname,
  '..',
  'config',
  'split_rules.json'
);
let splitRules = { standard: {}, future: {} };
try {
  const raw = fs.readFileSync(splitRulesPath, 'utf-8');
  splitRules = JSON.parse(raw);
} catch (e) {
  console.error('[CashFlowService] Failed to load split_rules.json', e);
}

/**
 * Determine split breakdown for a given transaction.
 * Returns an array of objects: { category, amount }.
 * The logic matches descriptions in transaction metadata (if any) or falls back
 * to heuristic based on transaction type.
 */
export const splitTransaction = (transaction) => {
  const { type, amount, metadata = {} } = transaction;
  // If metadata contains explicit split map, use it directly
  if (metadata.split && typeof metadata.split === 'object') {
    return Object.entries(metadata.split).map(([cat, val]) => ({
      category: cat,
      amount: Number(val),
    }));
  }

  // Heuristic fallback based on known transaction types
  const splits = [];
  const remaining = amount;
  // Mapping of transaction type to standard category key
  const typeMap = {
    registration: 'registration_fee',
    deposit: 'wallet_funding',
    wallet_topup: 'wallet_funding',
    contribution: 'savings_contribution',
    default_repayment: 'default_repayment',
    late_incentive: 'late_incentive',
    cooperative_program: 'cooperative_program',
    merchandise: 'merchandise',
    payout_reversal: 'payout_reversal',
    referral_income: 'referral_income',
  };

  const catKey = typeMap[type] || null;
  if (catKey && splitRules.standard[catKey]) {
    splits.push({ category: splitRules.standard[catKey], amount: remaining });
  } else {
    // Default to "operational income" if unknown
    splits.push({ category: 'Other Operational Income', amount: remaining });
  }
  return splits;
};

/**
 * Record a completed transaction in cash‑flow aggregates.
 * This should be called after the transaction status has been updated to
 * "completed" and any wallet balances have been adjusted.
 */
export const recordTransaction = async (transaction) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Save split details for audit (JSON column on transactions table)
    const splitDetails = splitTransaction(transaction);
    await client.query(
      `UPDATE transactions SET split_details = $1 WHERE id = $2`,
      [JSON.stringify(splitDetails), transaction.id]
    );

    const today = new Date().toISOString().slice(0, 10); // YYYY‑MM‑DD

    // Update daily cash‑flow totals
    const { rows: dailyRows } = await client.query(
      `SELECT * FROM cash_flow_daily WHERE date = $1 FOR UPDATE`,
      [today]
    );
    let daily = dailyRows[0];
    if (!daily) {
      const { rows } = await client.query(
        `INSERT INTO cash_flow_daily (date, total_inflow, total_outflow, balance) VALUES ($1, 0, 0, 0) RETURNING *`,
        [today]
      );
      daily = rows[0];
    }

    // Determine inflow/outflow based on sign – all our transaction amounts are positive.
    // Inflows are credit to the cooperative (e.g., deposits, contributions).
    // Outflows are payouts/withdrawals – these are recorded as separate transaction types.
    const isInflow = ['registration', 'deposit', 'wallet_topup', 'contribution', 'default_repayment', 'late_incentive', 'cooperative_program', 'merchandise', 'referral_income'].includes(
      transaction.type
    );
    const inflowAmt = isInflow ? transaction.amount : 0;
    const outflowAmt = isInflow ? 0 : transaction.amount;

    await client.query(
      `UPDATE cash_flow_daily SET total_inflow = total_inflow + $1, total_outflow = total_outflow + $2, balance = (total_inflow - total_outflow) WHERE date = $3`,
      [inflowAmt, outflowAmt, today]
    );

    // Update category totals (snapshot per day)
    for (const { category, amount } of splitDetails) {
      await client.query(
        `INSERT INTO cash_flow_category_totals (category, total_amount, date) VALUES ($1, $2, $3)
         ON CONFLICT (category, date) DO UPDATE SET total_amount = cash_flow_category_totals.total_amount + EXCLUDED.total_amount`,
        [category, amount, today]
      );
    }

    // Create ledger entries for each split (wallet_transactions table)
    for (const { category, amount } of splitDetails) {
      const description = `Cash‑flow split – ${category}`;
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, reference, description) VALUES ($1, $2, $3, $4, $5)`,
        [transaction.user_id, isInflow ? 'credit' : 'debit', amount, transaction.reference, description]
      );
    }

    // Optional: send admin notification for large or anomalous transactions
    if (transaction.amount >= 500000) {
      await createNotification(
        null, // broadcast to admins
        'ALERT',
        'Large Transaction Detected',
        `A transaction of ₦${transaction.amount.toLocaleString()} (${transaction.type}) was processed.`
      ).catch(() => {});
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CashFlowService] recordTransaction error', err);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Generate risk alerts for a given day – called by a scheduled job.
 * Scans for mismatches between daily totals and sum of category totals,
 * duplicate references, missing ledger entries, etc.
 */
export const generateRiskAlerts = async (date) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: daily } = await client.query(
      `SELECT * FROM cash_flow_daily WHERE date = $1`,
      [date]
    );
    if (!daily.length) return [];
    const df = daily[0];

    const { rows: catSum } = await client.query(
      `SELECT SUM(total_amount) as sum FROM cash_flow_category_totals WHERE date = $1`,
      [date]
    );
    const catTotal = parseFloat(catSum[0].sum || 0);
    const net = parseFloat(df.total_inflow) - parseFloat(df.total_outflow);
    const alerts = [];
    if (Math.abs(net - catTotal) > 0.01) {
      alerts.push({
        level: 'critical',
        message: `Reconciliation mismatch on ${date}: net ${net} vs category sum ${catTotal}`,
      });
    }
    // Duplicate transaction check
    const { rows: dup } = await client.query(
      `SELECT reference, COUNT(*) cnt FROM transactions WHERE DATE(created_at) = $1 GROUP BY reference HAVING COUNT(*) > 1`,
      [date]
    );
    if (dup.length) {
      alerts.push({
        level: 'critical',
        message: `Duplicate transactions found on ${date}: ${dup.map(r => r.reference).join(', ')}`,
      });
    }
    // Missing ledger entries check – ensure each transaction has a wallet_transaction entry
    const { rows: missing } = await client.query(
      `SELECT t.id FROM transactions t LEFT JOIN wallet_transactions w ON w.reference = t.reference WHERE DATE(t.created_at) = $1 AND w.id IS NULL`,
      [date]
    );
    if (missing.length) {
      alerts.push({
        level: 'warning',
        message: `Transactions without ledger entries on ${date}: ${missing.map(r => r.id).join(', ')}`,
      });
    }
    await client.query('COMMIT');
    return alerts;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[CashFlowService] generateRiskAlerts error', e);
    throw e;
  } finally {
    client.release();
  }
};
