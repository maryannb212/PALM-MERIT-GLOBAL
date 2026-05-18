import { getClient, query } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { createWalletLedgerEntry } from '../models/transactionModel.js';
import { createNotification } from '../models/notificationModel.js';

/**
 * Request a withdrawal
 * POST /api/transactions/withdraw
 */
export const requestWithdrawal = async (req, res) => {
  const userId = req.user.id;
  const { amount, bankDetails } = req.body; // bankDetails: { accountName, accountNumber, bankName }

  if (!amount || parseFloat(amount) < 500) {
    return res.status(400).json({ message: 'Minimum withdrawal amount is ₦500' });
  }

  if (!bankDetails?.accountNumber || !bankDetails?.bankName || !bankDetails?.accountName) {
    return res.status(400).json({ message: 'Bank details are required.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Check user balance and KYC status
    const userSql = `SELECT available_balance, held_balance, kyc_status FROM users WHERE id = $1 FOR UPDATE;`;
    const { rows: userRows } = await client.query(userSql, [userId]);
    const user = userRows[0];

    // 1.5 Fetch user's oldest savings plan to evaluate grace period
    const oldestPlanSql = `SELECT created_at FROM savings_plans WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1;`;
    const { rows: planRows } = await client.query(oldestPlanSql, [userId]);
    
    let isKycCompulsory = false;
    if (planRows.length > 0) {
      const oldestPlanDate = new Date(planRows[0].created_at);
      const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
      if (new Date() - oldestPlanDate > ninetyDaysInMs) {
        isKycCompulsory = true;
      }
    }

    if (isKycCompulsory && user.kyc_status !== 'verified') {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'KYC verification is now compulsory (90 days have elapsed since starting your first savings program).' });
    }

    if (parseFloat(user.available_balance) < parseFloat(amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Insufficient available balance.' });
    }

    // 2. Move funds: available_balance -> held_balance
    const moveFundsSql = `
      UPDATE users 
      SET available_balance = available_balance - $1, 
          held_balance = held_balance + $1,
          wallet_balance = wallet_balance - $1
      WHERE id = $2 
      RETURNING available_balance, held_balance;
    `;
    const { rows: updateRows } = await client.query(moveFundsSql, [amount, userId]);

    // 3. Create pending withdrawal transaction
    const reference = `WD-${uuidv4().substring(0, 8).toUpperCase()}`;
    const transSql = `
      INSERT INTO transactions (user_id, type, amount, status, reference)
      VALUES ($1, 'withdrawal', $2, 'pending', $3)
      RETURNING *;
    `;
    const { rows: transRows } = await client.query(transSql, [userId, amount, reference]);
    const transaction = transRows[0];

    // 4. Save bank details
    const detailsSql = `
      INSERT INTO withdrawal_details (user_id, transaction_id, account_name, account_number, bank_name)
      VALUES ($1, $2, $3, $4, $5);
    `;
    await client.query(detailsSql, [userId, transaction.id, bankDetails.accountName, bankDetails.accountNumber, bankDetails.bankName]);

    // 5. Ledger entry (debit for hold)
    await createWalletLedgerEntry(client, userId, 'debit', amount, reference, `Withdrawal Request (Hold): ${bankDetails.bankName} - ${bankDetails.accountNumber}`);

    await client.query('COMMIT');

    // Fire notification (non-blocking)
    createNotification(userId, 'ALERT', 'Withdrawal Requested', `Your withdrawal request of ₦${parseFloat(amount).toLocaleString()} is being processed. funds are held until approval.`);

    res.status(201).json({
      message: 'Withdrawal request submitted successfully.',
      transaction,
      newBalance: updateRows[0].available_balance
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Withdrawal Request Error:', error);
    res.status(500).json({ message: 'Server error during withdrawal request.' });
  } finally {
    client.release();
  }
};

/**
 * Admin: Approve withdrawal
 * PUT /api/admin/withdrawals/:id/approve
 */
export const approveWithdrawal = async (req, res) => {
  const { id } = req.params;
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock transaction
    const { rows: transRows } = await client.query(
      `SELECT * FROM transactions WHERE id = $1 AND type = 'withdrawal' AND status = 'pending' FOR UPDATE`,
      [id]
    );
    if (transRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Pending withdrawal not found' });
    }
    const transaction = transRows[0];

    // 2. Finalize: Reduce held_balance
    await client.query(
      `UPDATE users SET held_balance = held_balance - $1 WHERE id = $2`,
      [transaction.amount, transaction.user_id]
    );

    // 3. Mark completed
    const { rows } = await client.query(
      `UPDATE transactions SET status = 'completed' WHERE id = $1 RETURNING *`,
      [id]
    );

    await client.query('COMMIT');

    createNotification(transaction.user_id, 'PAYMENT', 'Withdrawal Approved', `Your withdrawal of ₦${parseFloat(transaction.amount).toLocaleString()} has been approved and sent to your bank.`);

    res.json({ message: 'Withdrawal approved', transaction: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve Withdrawal Error:', error);
    res.status(500).json({ message: 'Server error approving withdrawal' });
  } finally {
    client.release();
  }
};

/**
 * Admin: Reject withdrawal
 * PUT /api/admin/withdrawals/:id/reject
 */
export const rejectWithdrawal = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock transaction
    const { rows: transRows } = await client.query(
      `SELECT * FROM transactions WHERE id = $1 AND type = 'withdrawal' AND status = 'pending' FOR UPDATE`,
      [id]
    );
    if (transRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Pending withdrawal not found' });
    }
    const transaction = transRows[0];

    // 2. Return funds: held_balance -> available_balance
    await client.query(
      `UPDATE users SET held_balance = held_balance - $1, available_balance = available_balance + $1, wallet_balance = wallet_balance + $1 WHERE id = $2`,
      [transaction.amount, transaction.user_id]
    );

    // 3. Mark cancelled
    const { rows } = await client.query(
      `UPDATE transactions SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );

    // 4. Ledger entry (credit to reverse hold)
    await createWalletLedgerEntry(client, transaction.user_id, 'credit', transaction.amount, transaction.reference, `Withdrawal Rejected: ${reason || 'No reason provided'}`);

    await client.query('COMMIT');

    createNotification(transaction.user_id, 'ALERT', 'Withdrawal Rejected', `Your withdrawal of ₦${parseFloat(transaction.amount).toLocaleString()} was rejected. Reason: ${reason || 'N/A'}. Funds returned to your wallet.`);

    res.json({ message: 'Withdrawal rejected', transaction: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reject Withdrawal Error:', error);
    res.status(500).json({ message: 'Server error rejecting withdrawal' });
  } finally {
    client.release();
  }
};
