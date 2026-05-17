import { query, getClient } from '../config/db.js';

/**
 * Create a new PENDING transaction record.
 * Called at payment initialisation time — before the user visits Paystack.
 *
 * @param {string} userId
 * @param {string|null} planId      - savings_plans.id (null for plain wallet top-ups)
 * @param {string} type             - 'deposit' | 'withdrawal' | 'membership' | 'penalty'
 * @param {number} amount
 * @param {string} reference        - Unique gateway reference
 * @returns {Promise<object>}
 */
export const createTransaction = async (userId, planId, type, amount, reference, paymentProvider = null) => {
  const text = `
    INSERT INTO transactions (user_id, plan_id, type, amount, reference, payment_provider, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    ON CONFLICT (reference) DO NOTHING
    RETURNING *;
  `;
  const { rows } = await query(text, [userId, planId, type, amount, reference, paymentProvider]);

  // If a row already existed for this reference return the existing one
  if (!rows[0]) {
    const existing = await query(
      'SELECT * FROM transactions WHERE reference = $1',
      [reference]
    );
    return existing.rows[0];
  }
  return rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// IDEMPOTENT PAYMENT PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a completed Paystack payment atomically and idempotently.
 *
 * RULES:
 *  1. Open a DB transaction.
 *  2. Lock the transactions row by reference (FOR UPDATE).
 *  3. If the row is ALREADY 'completed' → return { isDuplicate: true }.
 *  4. If the row does NOT exist → this is an unrecognised reference; throw.
 *  5. Mark the transaction as 'completed'.
 *  6. Credit the wallet (UPDATE users SET wallet_balance = wallet_balance + amount).
 *  7. Commit.
 *
 * This function is the single source of truth for wallet crediting.
 * It MUST be called instead of the old updateTransactionStatus for payment events.
 *
 * @param {string} reference      - Payment gateway reference (our unique system ref)
 * @param {number} verifiedAmount - Amount confirmed by Provider API (in NGN)
 * @param {string} gatewayRef     - Optional: Provider's own internal reference
 * @param {string} provider       - Optional: 'paystack' | 'flutterwave'
 * @returns {Promise<{ isDuplicate: boolean, transaction: object }>}
 */
export const processCompletedPayment = async (reference, verifiedAmount = null, gatewayRef = null, provider = null) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // ── STEP 1: Lock the row to prevent concurrent processing ─────────────────
    const { rows: lockRows } = await client.query(
      `SELECT * FROM transactions WHERE reference = $1 FOR UPDATE`,
      [reference]
    );

    if (lockRows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error(`REFERENCE_NOT_FOUND: No transaction exists for reference ${reference}`);
    }

    const transaction = lockRows[0];

    // ── STEP 2: Idempotency guard ─────────────────────────────────────────────
    if (transaction.status === 'completed') {
      await client.query('ROLLBACK');
      console.warn(`[Idempotency] Duplicate payment attempt blocked — reference: ${reference}`);
      return { isDuplicate: true, transaction };
    }

    // ── STEP 3: Amount mismatch guard ─────────────────────────────────────────
    if (verifiedAmount !== null) {
      const storedAmount = parseFloat(transaction.amount);
      const diff = Math.abs(storedAmount - verifiedAmount);
      if (diff > 0.01) {
        await client.query('ROLLBACK');
        throw new Error(`AMOUNT_MISMATCH: Expected ${storedAmount} but got ${verifiedAmount}`);
      }
    }

    // ── STEP 4: Mark transaction completed ────────────────────────────────────
    const updateTxSql = `
      UPDATE transactions
      SET status = 'completed',
          provider_reference = COALESCE($1, provider_reference),
          gateway_reference = COALESCE($1, gateway_reference),
          payment_provider = COALESCE($2, payment_provider)
      WHERE reference = $3
      RETURNING *;
    `;
    const { rows: updatedTx } = await client.query(updateTxSql, [gatewayRef, provider, reference]);
    const completedTx = updatedTx[0];

    // ── STEP 5: Process based on type ────────────────────────────────────────
    if (completedTx.type === 'deposit' || completedTx.type === 'wallet_topup' || completedTx.type === 'contribution') {
      if (completedTx.plan_id) {
        // Linked to a savings plan
        await client.query(
          `UPDATE savings_plans SET current_amount = current_amount + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [completedTx.amount, completedTx.plan_id]
        );
      } else {
        // Generic wallet top-up
        await client.query(
          `UPDATE users SET available_balance = available_balance + $1, wallet_balance = wallet_balance + $1 WHERE id = $2`,
          [completedTx.amount, completedTx.user_id]
        );
        
        // Ledger entry
        await createWalletLedgerEntry(client, completedTx.user_id, 'credit', completedTx.amount, reference, 'Wallet Top-up');
      }
    } else if (completedTx.type === 'membership') {
      await client.query(`UPDATE users SET has_paid_membership = TRUE WHERE id = $1`, [completedTx.user_id]);
    } else if (completedTx.type === 'clearance') {
      // Clearance fee payment
      const { rows: planRows } = await client.query('SELECT * FROM savings_plans WHERE id = $1', [completedTx.plan_id]);
      if (planRows.length > 0) {
        const plan = planRows[0];
        const payoutDate = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
        
        await client.query(
          `UPDATE savings_plans SET status = 'pending_settlement', clearance_paid = TRUE, clearance_date = CURRENT_TIMESTAMP, payout_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [payoutDate, completedTx.plan_id]
        );

        const expectedAmount = plan.plan_name === 'CREST' ? 96000 : (plan.plan_name === 'SILVER' ? 150000 : plan.target_amount);
        
        // Check if a payout record already exists to prevent duplicate payouts
        const { rows: payoutRows } = await client.query('SELECT * FROM payouts WHERE plan_id = $1', [completedTx.plan_id]);
        if (payoutRows.length === 0) {
          await client.query(`
            INSERT INTO payouts (user_id, plan_id, amount, payout_type, status)
            VALUES ($1, $2, $3, 'cash', 'pending')
          `, [completedTx.user_id, completedTx.plan_id, expectedAmount]);
        }
      }
    }

    await client.query('COMMIT');
    return { isDuplicate: false, transaction: completedTx };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Create a ledger entry in wallet_transactions
 */
export const createWalletLedgerEntry = async (client, userId, type, amount, reference, description) => {
  const sql = `
    INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [userId, type, amount, reference, description]);
  return rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY HELPER (kept for non-payment status updates, e.g. setting 'failed')
// DO NOT use this to mark transactions 'completed' — use processCompletedPayment.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a transaction's status (for non-payment flows, e.g. marking failed).
 * Does NOT trigger any wallet side-effects.
 *
 * @param {string} reference
 * @param {'failed'|'pending'} status
 * @returns {Promise<object|null>}
 */
export const updateTransactionStatus = async (reference, status) => {
  if (status === 'completed') {
    throw new Error(
      'updateTransactionStatus must not be used to mark transactions completed. ' +
      'Use processCompletedPayment() instead.'
    );
  }
  const { rows } = await query(
    `UPDATE transactions SET status = $1 WHERE reference = $2 RETURNING *`,
    [status, reference]
  );
  return rows[0] || null;
};

/**
 * Get all transactions for a user, newest first.
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export const getUserTransactions = async (userId) => {
  const sql = `
    SELECT t.*, p.plan_name
    FROM transactions t
    LEFT JOIN savings_plans p ON t.plan_id = p.id
    WHERE t.user_id = $1
    ORDER BY t.created_at DESC;
  `;
  const { rows } = await query(sql, [userId]);
  return rows;
};

/**
 * Look up a single transaction by reference.
 *
 * @param {string} reference
 * @returns {Promise<object|null>}
 */
export const getTransactionByReference = async (reference) => {
  const { rows } = await query(
    'SELECT * FROM transactions WHERE reference = $1',
    [reference]
  );
  return rows[0] || null;
};
