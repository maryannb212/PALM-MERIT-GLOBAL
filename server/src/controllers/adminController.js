import { query } from '../config/db.js';
import { createNotification } from '../models/notificationModel.js';
import { logAudit } from '../models/auditModel.js';
import { processCompletedPayment } from '../models/transactionModel.js';
import * as withdrawalController from './withdrawalController.js';

/**
 * Get all users
 * GET /api/admin/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, created_at
      FROM users 
      ORDER BY created_at DESC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

/**
 * Get user by ID
 * GET /api/admin/users/:id
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, created_at
      FROM users 
      WHERE id = $1;
    `;
    const result = await query(sql, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
};

/**
 * Get dashboard statistics
 * GET /api/admin/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'user' AND created_at >= CURRENT_DATE) as users_today,
        (SELECT COUNT(*) FROM users WHERE kyc_status = 'verified') as verified_users,
        (SELECT COUNT(*) FROM savings_plans WHERE status = 'active') as active_plans,
        (SELECT COALESCE(SUM(current_amount), 0) FROM savings_plans WHERE status = 'active') as total_savings,
        (SELECT COALESCE(SUM(available_balance + held_balance), 0) FROM users WHERE role = 'user') as total_liabilities,
        (SELECT COUNT(*) FROM tickets WHERE status = 'open') as open_tickets,
        (SELECT COUNT(*) FROM users WHERE kyc_status = 'pending') as pending_kyc
    `;
    const result = await query(sql);
    const data = result.rows[0];

    // Get recent users
    const recentUsersSql = `
      SELECT first_name, last_name, email, created_at 
      FROM users 
      WHERE role = 'user' 
      ORDER BY created_at DESC 
      LIMIT 5
    `;
    const recentUsers = await query(recentUsersSql);

    res.json({
      totalUsers: parseInt(data.total_users),
      usersToday: parseInt(data.users_today),
      verifiedUsers: parseInt(data.verified_users),
      activePlans: parseInt(data.active_plans),
      totalSavings: parseFloat(data.total_savings),
      totalLiabilities: parseFloat(data.total_liabilities),
      openTickets: parseInt(data.open_tickets),
      pendingKYC: parseInt(data.pending_kyc),
      recentUsers: recentUsers.rows
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
};

/**
 * Get all support tickets
 * GET /api/admin/tickets
 */
export const getAllTickets = async (req, res) => {
  try {
    const sql = `
      SELECT t.*, u.first_name, u.last_name, u.email 
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all tickets:', error);
    res.status(500).json({ message: 'Server error fetching tickets' });
  }
};

/**
 * Update ticket status and optionally add a reply
 * PUT /api/admin/tickets/:id
 */
export const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminReply } = req.body;

    const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    let sql = `UPDATE tickets SET updated_at = CURRENT_TIMESTAMP`;
    const params = [id];

    if (status) {
      sql += `, status = $${params.push(status)}`;
    }
    
    // We'll need to add admin_reply column if it doesn't exist, 
    // for now let's assume it's part of the tickets table or we handle it via notifications
    
    sql += ` WHERE id = $1 RETURNING *`;
    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (adminReply) {
      await createNotification(
        result.rows[0].user_id,
        'SUPPORT',
        'Support Ticket Update',
        `Admin replied to your ticket: ${adminReply}`
      );
    }

    await logAudit(req.user.id, 'UPDATE_TICKET', 'ticket', id, { status, adminReply });

    res.json({ message: 'Ticket updated', ticket: result.rows[0] });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ message: 'Server error updating ticket' });
  }
};

/**
 * Broadcast notification to all users or a specific user
 * POST /api/admin/notifications/broadcast
 */
export const broadcastNotification = async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    if (userId) {
      // Single user
      await createNotification(userId, type || 'SYSTEM', title, message);
    } else {
      // All users
      const users = await query("SELECT id FROM users WHERE role = 'user'");
      for (const user of users.rows) {
        await createNotification(user.id, type || 'SYSTEM', title, message);
      }
    }

    await logAudit(req.user.id, 'BROADCAST_NOTIFICATION', 'notification', userId || 'all', { title, type });

    res.json({ message: 'Notification(s) sent successfully' });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    res.status(500).json({ message: 'Server error broadcasting notification' });
  }
};

/**
 * Get defaulters (users with active defaults)
 * GET /api/admin/defaulters
 */
export const getDefaulters = async (req, res) => {
  try {
    const sql = `
      SELECT d.*, u.first_name, u.last_name, u.email, sp.plan_name
      FROM defaults d
      JOIN users u ON d.user_id = u.id
      JOIN savings_plans sp ON d.plan_id = sp.id
      WHERE d.resolved = FALSE
      ORDER BY d.created_at DESC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching defaulters:', error);
    res.status(500).json({ message: 'Server error fetching defaulters' });
  }
};

/**
 * Get reconciliation stats
 * GET /api/admin/reconciliation
 */
export const getReconciliationStats = async (req, res) => {
  try {
    const txSql = `
      SELECT type, status, COUNT(*), SUM(amount) as total_amount
      FROM transactions
      GROUP BY type, status
      ORDER BY type, status;
    `;
    const txResult = await query(txSql);

    const liabilitySql = `
      SELECT 
        SUM(available_balance) as available, 
        SUM(held_balance) as held,
        SUM(available_balance + held_balance) as total
      FROM users 
      WHERE role = 'user';
    `;
    const libResult = await query(liabilitySql);

    res.json({
      transactions: txResult.rows,
      liabilities: libResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching reconciliation stats:', error);
    res.status(500).json({ message: 'Server error fetching reconciliation stats' });
  }
};

/**
 * Approve manual payment
 * POST /api/admin/approve-payment/:transactionId
 */
export const approveManualPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transactionSql = `SELECT * FROM transactions WHERE id = $1 AND status = 'pending'`;
    const transResult = await query(transactionSql, [transactionId]);
    
    if (transResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pending transaction not found' });
    }
    
    const transaction = transResult.rows[0];
    
    // Route through atomic payment processor
    const { isDuplicate } = await processCompletedPayment(transaction.reference);
    
    if (isDuplicate) {
      return res.status(400).json({ message: 'Transaction was already processed.' });
    }

    await logAudit(req.user.id, 'APPROVE_PAYMENT', 'transaction', transactionId, { amount: transaction.amount, reference: transaction.reference });
    
    await createNotification(
      transaction.user_id,
      'PAYMENT',
      'Payment Approved',
      `Your payment of ₦${parseFloat(transaction.amount).toLocaleString()} has been manually approved.`
    );

    res.json({ message: 'Payment approved and applied' });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ message: 'Server error approving payment' });
  }
};

/**
 * Admin: Approve withdrawal
 */
export const approveWithdrawal = (req, res) => withdrawalController.approveWithdrawal(req, res);

/**
 * Admin: Reject withdrawal
 */
export const rejectWithdrawal = (req, res) => withdrawalController.rejectWithdrawal(req, res);

/**
 * Admin: Get all pending withdrawals with bank details
 * GET /api/admin/withdrawals/pending
 */
export const getPendingWithdrawals = async (req, res) => {
  try {
    const sql = `
      SELECT t.*, u.first_name, u.last_name, u.email, wd.account_name, wd.account_number, wd.bank_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN withdrawal_details wd ON t.id = wd.transaction_id
      WHERE t.type = 'withdrawal' AND t.status = 'pending'
      ORDER BY t.created_at ASC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending withdrawals:', error);
    res.status(500).json({ message: 'Server error fetching pending withdrawals' });
  }
};

/**
 * Get all pending transactions for reconciliation
 * GET /api/admin/transactions/pending
 */
export const getPendingTransactions = async (req, res) => {
  try {
    const sql = `
      SELECT t.*, u.first_name, u.last_name, u.email
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    res.status(500).json({ message: 'Server error fetching pending transactions' });
  }
};
