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
      SELECT id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, wallet_balance, available_balance, held_balance, created_at
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
    
    // 1. Fetch user standard fields + wallet balances
    const userSql = `
      SELECT id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, 
             wallet_balance, available_balance, held_balance, created_at, profile_image, status
      FROM users 
      WHERE id = $1;
    `;
    const userResult = await query(userSql, [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // 2. Fetch KYC details
    const kycSql = `
      SELECT first_name, last_name, middle_name, phone, email, address, gender, dob, bvn, 
             bank_name, account_number, id_type, id_number, document_url, document_back_url, selfie_url, submitted_at
      FROM kyc_details
      WHERE user_id = $1;
    `;
    const kycResult = await query(kycSql, [id]);
    user.kyc = kycResult.rows[0] || null;
    
    // 3. Fetch all Bank Accounts
    const bankSql = `
      SELECT account_name, account_number, bank_name, is_primary
      FROM bank_accounts
      WHERE user_id = $1
      ORDER BY is_primary DESC, created_at DESC;
    `;
    const bankResult = await query(bankSql, [id]);
    user.bank_accounts = bankResult.rows;
    
    // 4. Fetch Savings Plans
    const plansSql = `
      SELECT id, plan_name, status, start_date, end_date, target_amount, current_amount, 
             interest_rate, number_of_accounts, clearance_required, clearance_paid, maturity_date
      FROM savings_plans
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const plansResult = await query(plansSql, [id]);
    user.savings_plans = plansResult.rows;
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user detailed info:', error);
    res.status(500).json({ message: 'Server error fetching user details' });
  }
};

/**
 * Update user details
 * PUT /api/admin/users/:id
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, role, has_paid_membership, wallet_balance, available_balance, held_balance } = req.body;

    const sql = `
      UPDATE users 
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          role = COALESCE($5, role),
          has_paid_membership = COALESCE($6, has_paid_membership),
          wallet_balance = COALESCE($7, wallet_balance),
          available_balance = COALESCE($8, available_balance),
          held_balance = COALESCE($9, held_balance)
      WHERE id = $10
      RETURNING id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, wallet_balance, available_balance, held_balance;
    `;
    const result = await query(sql, [first_name, last_name, email, phone, role, has_paid_membership, wallet_balance, available_balance, held_balance, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
};

/**
 * Delete a user
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Perform a hard delete (this will cascade if foreign keys are set up, 
    // otherwise manual deletion of child records might be needed). 
    // The database schema has ON DELETE CASCADE for most relationships.
    const sql = `DELETE FROM users WHERE id = $1 RETURNING id`;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user' });
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

/**
 * Get all users and their detailed referral chains and anti-abuse flags
 * GET /api/admin/referrals
 */
export const getAdminReferralStats = async (req, res) => {
  try {
    const { rows: users } = await query(`
      SELECT id, first_name, last_name, email, phone, referral_code, referred_by, referral_unlock_date, status, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    const result = [];
    for (const u of users) {
      const directDownlines = users.filter(down => down.referred_by === u.id);
      
      let activeQualifiedCount = 0;
      const downlineDetails = [];
      
      for (const down of directDownlines) {
        const { rows: plans } = await query(
          'SELECT plan_name, current_amount, total_paid FROM savings_plans WHERE user_id = $1',
          [down.id]
        );
        
        const isSuspended = down.status && down.status.toLowerCase() !== 'active';
        const hasGoldenBasket = plans.some(p => p.plan_name === 'GOLDEN_BASKET');
        const hasStandardPlan = plans.some(p => p.plan_name !== 'GOLDEN_BASKET');
        const totalStandardPaid = plans.filter(p => p.plan_name !== 'GOLDEN_BASKET')
                                       .reduce((sum, p) => sum + parseFloat(p.current_amount || p.total_paid || 0), 0);
        
        let referralStatus = 'inactive';
        if (isSuspended) {
          referralStatus = 'disqualified';
        } else if (plans.length === 0) {
          referralStatus = 'inactive';
        } else if (plans.length > 0 && !hasStandardPlan) {
          referralStatus = 'disqualified';
        } else if (totalStandardPaid > 0) {
          referralStatus = 'qualified';
          activeQualifiedCount++;
        } else {
          referralStatus = 'pending';
        }

        downlineDetails.push({
          id: down.id,
          firstName: down.first_name,
          lastName: down.last_name,
          email: down.email,
          referralStatus
        });
      }

      let isSelfReferralSuspected = false;
      const { rows: userBanks } = await query('SELECT account_number FROM bank_accounts WHERE user_id = $1', [u.id]);
      if (userBanks.length > 0) {
        const userBankNum = userBanks[0].account_number;
        for (const down of directDownlines) {
          const { rows: downBanks } = await query('SELECT id FROM bank_accounts WHERE user_id = $1 AND account_number = $2', [down.id, userBankNum]);
          if (downBanks.length > 0) {
            isSelfReferralSuspected = true;
            break;
          }
        }
      }

      result.push({
        id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        createdAt: u.created_at,
        referralCode: u.referral_code,
        referralUnlockDate: u.referral_unlock_date,
        downlinesCount: directDownlines.length,
        activeQualifiedCount,
        isEligible: activeQualifiedCount >= 2,
        isSuspicious: isSelfReferralSuspected,
        downlines: downlineDetails
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching admin referral stats:', error);
    res.status(500).json({ message: 'Server error fetching admin referral stats' });
  }
};

/**
 * Get all savings plans in the eligibility review phase
 * GET /api/admin/eligibility-queue
 */
export const getEligibilityQueue = async (req, res) => {
  try {
    const sql = `
      SELECT sp.*, u.first_name, u.last_name, u.email, u.phone
      FROM savings_plans sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.status = 'eligibility_review'
      ORDER BY sp.maturity_date ASC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching eligibility queue:', error);
    res.status(500).json({ message: 'Server error fetching eligibility queue' });
  }
};

/**
 * Approve a plan from eligibility review, setting final payout amount
 * POST /api/admin/approve-eligibility
 */
export const approveEligibility = async (req, res) => {
  try {
    const { planId, approvedAmount, notes } = req.body;

    if (!planId || !approvedAmount) {
      return res.status(400).json({ message: 'Plan ID and approved amount are required.' });
    }

    const { rows: plans } = await query('SELECT * FROM savings_plans WHERE id = $1', [planId]);
    if (plans.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    const plan = plans[0];

    if (plan.status !== 'eligibility_review') {
      return res.status(400).json({ message: 'Plan is not in eligibility review status' });
    }

    let newStatus = 'pending_settlement';
    let payoutDate = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));

    if (['CREST', 'SILVER'].includes(plan.plan_name)) {
      newStatus = 'pending_clearance';
      payoutDate = null;
    }

    await query('BEGIN');

    // Update plan status
    const updatePlanSql = `
      UPDATE savings_plans 
      SET status = $1, payout_date = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *;
    `;
    const updatedPlanResult = await query(updatePlanSql, [newStatus, payoutDate, planId]);

    // Create payout record
    const payoutType = plan.plan_name === 'GOLDEN_BASKET' ? 'goods' : 'cash';
    await query(`
      INSERT INTO payouts (user_id, plan_id, amount, payout_type, status, notes)
      VALUES ($1, $2, $3, $4, 'pending', $5)
    `, [plan.user_id, planId, approvedAmount, payoutType, notes || 'Approved by admin']);

    await logAudit(req.user.id, 'APPROVE_ELIGIBILITY', 'savings_plan', planId, { approvedAmount, newStatus });

    await query('COMMIT');

    res.json({ message: 'Plan eligibility approved successfully', plan: updatedPlanResult.rows[0] });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Error approving eligibility:', error);
    res.status(500).json({ message: 'Server error approving eligibility' });
  }
};

