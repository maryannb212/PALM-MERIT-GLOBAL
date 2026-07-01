import { query, getClient } from '../config/db.js';
import { createNotification } from '../models/notificationModel.js';
import { logAudit } from '../models/auditModel.js';
import { processCompletedPayment, createTransaction } from '../models/transactionModel.js';
import * as withdrawalController from './withdrawalController.js';

/**
 * Get all users
 * GET /api/admin/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone, u.role, 
        u.has_paid_membership, u.kyc_status, u.wallet_balance, u.available_balance, u.held_balance, u.created_at,
        u.referral_code, u.referred_by,
        referrer.first_name AS referrer_first_name,
        referrer.last_name AS referrer_last_name,
        (SELECT COUNT(*) FROM users sub WHERE sub.referred_by = u.id AND sub.id != u.id) AS downline_count,
        COALESCE(d.outstanding, 0) as outstanding_default,
        COALESCE(d.cnt, 0) as default_count
      FROM users u
      LEFT JOIN users referrer ON u.referred_by = referrer.id
      LEFT JOIN (
        SELECT user_id, SUM(penalty_amount) as outstanding, COUNT(*) as cnt
        FROM defaults WHERE resolved = FALSE
        GROUP BY user_id
      ) d ON u.id = d.user_id
      ORDER BY u.created_at DESC;
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
             wallet_balance, available_balance, held_balance, created_at, profile_image, status,
             referral_code, referred_by, referral_unlock_date, referral_expiry_date
      FROM users 
      WHERE id = $1;
    `;
    const userResult = await query(userSql, [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];

    // Fetch referrer name if referred_by is set
    if (user.referred_by) {
      const { rows: referrer } = await query(
        'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
        [user.referred_by]
      );
      user.referred_by_user = referrer.length > 0 ? referrer[0] : null;
    }

    // Fetch downlines (users this person referred)
    const { rows: downlines } = await query(`
      SELECT id, first_name, last_name, email, phone, status, created_at
      FROM users
      WHERE referred_by = $1
      ORDER BY created_at DESC
    `, [id]);
    user.downlines = downlines;
    user.downline_count = downlines.length;
    
    const kycSql = `
      SELECT first_name, last_name, middle_name, phone, email, address, gender, dob, bvn, 
             bank_name, account_number, id_type, id_number, document_url, document_back_url, selfie_url, submitted_at
      FROM kyc_details
      WHERE user_id = $1;
    `;
    const kycResult = await query(kycSql, [id]);
    user.kyc = kycResult.rows[0] || null;
    
    const bankSql = `
      SELECT account_name, account_number, bank_name, is_primary
      FROM bank_accounts
      WHERE user_id = $1
      ORDER BY is_primary DESC, created_at DESC;
    `;
    const bankResult = await query(bankSql, [id]);
    user.bank_accounts = bankResult.rows;
    
    const plansSql = `
      SELECT id, plan_name, status, start_date, end_date, target_amount, current_amount, 
             interest_rate, number_of_accounts, clearance_required, clearance_paid, maturity_date
      FROM savings_plans
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const plansResult = await query(plansSql, [id]);
    user.savings_plans = plansResult.rows;

    const defaultsSql = `
      SELECT id, plan_id, missed_date, penalty_amount, resolved, resolved_at, created_at
      FROM defaults
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const defaultsResult = await query(defaultsSql, [id]);
    user.defaults = defaultsResult.rows;

    const { rows: defaultSummary } = await query(
      `SELECT COALESCE(SUM(penalty_amount), 0) as outstanding_balance, COUNT(*) as default_count
       FROM defaults WHERE user_id = $1 AND resolved = FALSE`,
      [id]
    );
    user.outstanding_default = parseFloat(defaultSummary[0].outstanding_balance);
    user.default_count = parseInt(defaultSummary[0].default_count);
    user.savings_status = user.default_count > 0 ? 'defaulted' : 'active';
    
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
    const { first_name, last_name, email, phone, role, has_paid_membership, wallet_balance, available_balance, held_balance, referral_code, referred_by, referral_unlock_date, referral_expiry_date } = req.body;

    const toNum = (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const n = Number(val);
      return isNaN(n) ? null : n;
    };

    const toUUID = (val) => (val === '' || val === null || val === undefined ? null : val);

    const sql = `
      UPDATE users 
      SET first_name = COALESCE(NULLIF($1, ''), first_name),
          last_name = COALESCE(NULLIF($2, ''), last_name),
          email = COALESCE(NULLIF($3, ''), email),
          phone = COALESCE(NULLIF($4, ''), phone),
          role = COALESCE(NULLIF($5, ''), role),
          has_paid_membership = COALESCE($6, has_paid_membership),
          wallet_balance = COALESCE($7::numeric, wallet_balance),
          available_balance = COALESCE($8::numeric, available_balance),
          held_balance = COALESCE($9::numeric, held_balance),
          referral_code = COALESCE(NULLIF($10, ''), referral_code),
          referred_by = COALESCE($11, referred_by),
          referral_unlock_date = COALESCE($12::timestamp, referral_unlock_date),
          referral_expiry_date = COALESCE($13::timestamp, referral_expiry_date)
      WHERE id = $14
      RETURNING id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status, wallet_balance, available_balance, held_balance, referral_code, referred_by, referral_unlock_date, referral_expiry_date;
    `;
    const result = await query(sql, [first_name, last_name, email, phone, role, has_paid_membership, toNum(wallet_balance), toNum(available_balance), toNum(held_balance), referral_code, toUUID(referred_by), referral_unlock_date || null, referral_expiry_date || null, id]);

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
        (SELECT COUNT(*) FROM users WHERE kyc_status = 'pending') as pending_kyc,
        (SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL) as total_downlines,
        (SELECT COUNT(*) FROM users WHERE referral_code IS NOT NULL AND referral_code != '') as total_referral_codes
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
      totalDownlines: parseInt(data.total_downlines),
      totalReferralCodes: parseInt(data.total_referral_codes),
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
/**
 * Admin: Manually credit a user's wallet (for Lotus VA deposits when webhook wasn't received)
 * POST /api/admin/reconcile-lotus-va
 */
export const reconcileLotusVA = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'userId and a positive amount are required' });
    }

    const reference = `LVA-MANUAL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await createTransaction(userId, null, 'wallet_topup', parseFloat(amount), reference, 'lotus');

    const { isDuplicate } = await processCompletedPayment(reference);
    if (isDuplicate) {
      return res.status(400).json({ message: 'Transaction was already processed.' });
    }

    await logAudit(req.user.id, 'RECONCILE_LOTUS_VA', 'transaction', reference, { userId, amount });

    await createNotification(
      userId, 'PAYMENT', 'Wallet Credited (Manual Reconciliation)',
      `Your wallet has been credited with ₦${parseFloat(amount).toLocaleString()} via Lotus VA deposit reconciliation.`
    );

    try {
      await query(
        `INSERT INTO webhook_logs (source, reference, event_type, payload, signature_ok, status, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['lotus', reference, 'reserved_account.manual_reconciliation',
         JSON.stringify({ userId, amount, adminId: req.user.id }), true, 'processed',
         `Manual reconciliation: Credited ₦${amount} to user ${userId}`]
      );
    } catch (logErr) {
      console.warn('[reconcileLotusVA] Failed to log webhook event:', logErr.message);
    }

    res.json({ message: `Wallet credited with ₦${parseFloat(amount).toLocaleString()}`, reference });
  } catch (error) {
    console.error('[reconcileLotusVA] Error:', error.message);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

export const approveManualPayment = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { amount } = req.body;
    
    const transactionSql = `SELECT * FROM transactions WHERE id = $1 AND status = 'pending'`;
    const transResult = await query(transactionSql, [transactionId]);
    
    if (transResult.rows.length === 0) {
      return res.status(404).json({ message: 'Pending transaction not found' });
    }
    
    const transaction = transResult.rows[0];
    
    // If admin provided a specific amount, update the transaction before processing
    if (amount !== undefined && amount !== null && !isNaN(parseFloat(amount))) {
      const updateAmtSql = `UPDATE transactions SET amount = $1 WHERE id = $2`;
      await query(updateAmtSql, [parseFloat(amount), transactionId]);
      transaction.amount = parseFloat(amount);
    }
    
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
      SELECT id, first_name, last_name, email, phone, referral_code, referred_by, referral_unlock_date, referral_expiry_date, status, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    const result = [];
    for (const u of users) {
      const directDownlines = users.filter(down => down.referred_by === u.id && down.id !== u.id);
      
      let activeQualifiedCount = 0;
      const downlineDetails = [];
      
      for (const down of directDownlines) {
        const { rows: plans } = await query(
          'SELECT plan_name, current_amount FROM savings_plans WHERE user_id = $1',
          [down.id]
        );
        
        const isSuspended = down.status && down.status.toLowerCase() !== 'active';
        const hasGoldenBasket = plans.some(p => p.plan_name === 'GOLDEN_BASKET');
        const hasStandardPlan = plans.some(p => p.plan_name !== 'GOLDEN_BASKET');
        const totalStandardPaid = plans.filter(p => p.plan_name !== 'GOLDEN_BASKET')
                                       .reduce((sum, p) => sum + parseFloat(p.current_amount || 0), 0);
        
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
        referralExpiryDate: u.referral_expiry_date,
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

    // Validate that contributions are complete
    const expectedContributions = (() => {
      const cfg = {
        'CREST': { amount: 4000, weeks: 12 },
        'SILVER': { amount: 1500, weeks: 50 },
        'GOLDEN_BASKET': { amount: 2000, weeks: 50 },
        'ISUSU': { amount: 500, days: 30 }
      };
      const c = cfg[plan.plan_name];
      if (!c) return 0;
      const numAccounts = plan.number_of_accounts || 1;
      if (c.days) return c.amount * numAccounts * c.days;
      return c.amount * numAccounts * c.weeks;
    })();
    if (parseFloat(plan.current_amount || 0) < expectedContributions) {
      return res.status(400).json({
        message: `Plan has not completed all contributions. Current: ₦${parseFloat(plan.current_amount || 0).toLocaleString()}, Required: ₦${expectedContributions.toLocaleString()}`
      });
    }

    let newStatus = 'pending_settlement';
    let payoutDate = null;
    const planStart = new Date(plan.start_date);

    if (['CREST', 'SILVER'].includes(plan.plan_name)) {
      newStatus = 'pending_clearance';
    } else {
      switch (plan.plan_name) {
        case 'GOLDEN_BASKET':
          payoutDate = new Date(planStart.getTime() + (364 * 24 * 60 * 60 * 1000));
          break;
        default:
          payoutDate = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000));
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const updatePlanSql = `
        UPDATE savings_plans 
        SET status = $1, payout_date = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *;
      `;
      const updatedPlanResult = await client.query(updatePlanSql, [newStatus, payoutDate, planId]);

      const payoutType = plan.plan_name === 'GOLDEN_BASKET' ? 'goods' : 'cash';
      await client.query(`
        INSERT INTO payouts (user_id, plan_id, amount, payout_type, status, notes)
        VALUES ($1, $2, $3, $4, 'pending', $5)
      `, [plan.user_id, planId, approvedAmount, payoutType, notes || 'Approved by admin']);

      if (newStatus === 'pending_clearance') {
        const accounts = plan.number_of_accounts || 1;
        const totalFee = accounts * 3000;
        const msg = `${plan.plan_name} program has passed eligibility review. Pay ₦${totalFee.toLocaleString()} clearance fee (₦3,000 × ${accounts} account(s)) to proceed to settlement.`;
        await client.query(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES ($1, 'Clearance Required', $2, 'clearance')
        `, [plan.user_id, msg]);
      } else if (newStatus === 'pending_settlement') {
        const dateStr = payoutDate ? new Date(payoutDate).toLocaleDateString('en-NG') : 'the scheduled date';
        const msg = `${plan.plan_name} program has been approved for payout. Settlement will be processed on ${dateStr}.`;
        await client.query(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES ($1, 'Plan Approved for Payout', $2, 'payout')
        `, [plan.user_id, msg]);
      }

      await logAudit(req.user.id, 'APPROVE_ELIGIBILITY', 'savings_plan', planId, { approvedAmount, newStatus });

      await client.query('COMMIT');
      res.json({ message: 'Plan eligibility approved successfully', plan: updatedPlanResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error approving eligibility:', error);
      res.status(500).json({ message: 'Server error approving eligibility' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error acquiring client in approveEligibility:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getWebhookLogs = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM webhook_logs ORDER BY id DESC LIMIT 30`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ message: 'Failed to fetch webhook logs' });
  }
};

export const getSystemStatus = async (req, res) => {
  try {
    const lotusMerchant = process.env.LOTUS_MERCHANT_KEY || '';
    const lotusApiKey = process.env.LOTUS_X_API_KEY || '';
    const lotusWallet = process.env.LOTUS_WALLET_ID || '';
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
    const paymentMode = process.env.PAYMENT_MODE || 'live';

    res.json({
      paymentMode,
      lotus: {
        hasMerchantKey: lotusMerchant.length > 0,
        merchantKeyLength: lotusMerchant.length,
        merchantKeyPrefix: lotusMerchant.substring(0, 8),
        hasApiKey: lotusApiKey.length > 0,
        apiKeyLength: lotusApiKey.length,
        walletId: lotusWallet,
      },
      paystack: {
        hasSecretKey: paystackSecret.length > 0,
        secretKeyLength: paystackSecret.length,
        secretKeyPrefix: paystackSecret.substring(0, 7),
      }
    });
  } catch (error) {
    console.error('Error in getSystemStatus:', error);
    res.status(500).json({ message: 'Failed to fetch system status' });
  }
};

export const getTransactionDebug = async (req, res) => {
  try {
    const { reference } = req.params;
    
    // Find transaction
    const { rows: txRows } = await query(
      `SELECT t.*, u.email, u.first_name, u.last_name, u.virtual_account_number 
       FROM transactions t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE t.reference = $1 OR t.gateway_reference = $1 LIMIT 1`,
      [reference]
    );

    if (txRows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found in database' });
    }

    res.json(txRows[0]);
  } catch (error) {
    console.error('Error debugging transaction:', error);
    res.status(500).json({ message: 'Failed to debug transaction' });
  }
};

export const getRecentTransfers = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const { rows } = await query(
      `SELECT 
        t.id,
        t.reference,
        t.type,
        t.status,
        t.amount,
        t.payment_provider,
        t.created_at,
        u.first_name,
        u.last_name,
        u.email,
        u.virtual_account_number,
        u.wallet_balance,
        u.available_balance
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.created_at >= NOW() - ($1 || ' hours')::INTERVAL
        AND t.status = 'completed'
      ORDER BY t.created_at DESC`,
      [hours]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recent transfers:', error);
    res.status(500).json({ message: 'Failed to fetch recent transfers' });
  }
}

export const deleteTestPayment = async (req, res) => {
  try {
    const { id } = req.params;
    // Ensure the transaction is marked as a test payment before deleting
    const { rows: existing } = await query('SELECT is_test FROM transactions WHERE id = $1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    if (!existing[0].is_test) {
      return res.status(400).json({ message: 'Only test payments can be deleted' });
    }
    await query('DELETE FROM transactions WHERE id = $1', [id]);
    res.json({ message: 'Test payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting test payment:', error);
    res.status(500).json({ message: 'Failed to delete test payment' });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.id, t.reference, t.type, t.status, t.amount, t.payment_provider, t.created_at,
             u.first_name, u.last_name, u.email, u.virtual_account_number, u.wallet_balance, u.available_balance
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'completed'
      ORDER BY t.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ message: 'Failed to fetch all payments' });
  }
};;

/**
 * Get all defaults for a specific user (admin view)
 * GET /api/admin/users/:userId/defaults
 */
export const getUserDefaults = async (req, res) => {
  try {
    const { userId } = req.params;
    const { rows } = await query(`
      SELECT d.*, sp.plan_name, sp.number_of_accounts
      FROM defaults d
      JOIN savings_plans sp ON d.plan_id = sp.id
      WHERE d.user_id = $1
      ORDER BY d.missed_date DESC
    `, [userId]);
    const { rows: summary } = await query(`
      SELECT COALESCE(SUM(penalty_amount), 0) as total_outstanding, COUNT(*) as count
      FROM defaults WHERE user_id = $1 AND resolved = FALSE
    `, [userId]);
    res.json({ defaults: rows, summary: { outstanding: parseFloat(summary[0].total_outstanding), count: parseInt(summary[0].count) } });
  } catch (error) {
    console.error('Error fetching user defaults:', error);
    res.status(500).json({ message: 'Server error fetching user defaults' });
  }
};

/**
 * Update a single default record (edit penalty_amount or mark resolved)
 * PUT /api/admin/defaults/:id
 */
export const updateDefault = async (req, res) => {
  try {
    const { id } = req.params;
    const { penalty_amount, resolved } = req.body;
    const { rows } = await query(`
      UPDATE defaults
      SET penalty_amount = COALESCE($1, penalty_amount),
          resolved = COALESCE($2, resolved),
          resolved_at = CASE WHEN $2 = TRUE THEN CURRENT_TIMESTAMP ELSE resolved_at END
      WHERE id = $3
      RETURNING *
    `, [penalty_amount ?? null, resolved ?? null, id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Default not found' });
    await logAudit(req.user.id, 'UPDATE_DEFAULT', 'defaults', id, { penalty_amount, resolved });
    res.json({ message: 'Default updated', default: rows[0] });
  } catch (error) {
    console.error('Error updating default:', error);
    res.status(500).json({ message: 'Server error updating default' });
  }
};

/**
 * Resolve all outstanding defaults for a user
 * POST /api/admin/users/:userId/resolve-defaults
 */
export const resolveUserDefaults = async (req, res) => {
  try {
    const { userId } = req.params;
    const { rows } = await query(`
      UPDATE defaults SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND resolved = FALSE
      RETURNING *
    `, [userId]);
    await logAudit(req.user.id, 'RESOLVE_USER_DEFAULTS', 'defaults', userId, { count: rows.length });
    await createNotification(userId, 'SYSTEM', 'Defaults Cleared',
      `Admin has cleared all ${rows.length} outstanding default(s) on your account.`);
    res.json({ message: `Resolved ${rows.length} default(s)`, count: rows.length, defaults: rows });
  } catch (error) {
    console.error('Error resolving user defaults:', error);
    res.status(500).json({ message: 'Server error resolving defaults' });
  }
};

/**
 * Get all active plans grouped by user with due status, progress, and defaults
 * GET /api/admin/due-payments
 */
export const getDuePayments = async (req, res) => {
  try {
    const PLAN_CONFIG = {
      'CREST': { amount: 4000, isDaily: false, duration_days: 84 },
      'SILVER': { amount: 1500, isDaily: false, duration_days: 350 },
      'GOLDEN_BASKET': { amount: 2000, isDaily: false, duration_days: 350 },
      'ISUSU': { amount: 500, isDaily: true, duration_days: 30 }
    };

    const { rows: activePlans } = await query(`
      SELECT 
        sp.id AS plan_id,
        sp.plan_name,
        sp.start_date,
        sp.maturity_date,
        sp.number_of_accounts,
        sp.preferred_day,
        sp.current_amount,
        sp.target_amount,
        sp.user_id,
        u.first_name,
        u.last_name,
        u.email,
        (SELECT created_at FROM transactions 
         WHERE plan_id = sp.id AND type IN ('savings', 'penalty') AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1) AS last_payment_date
      FROM savings_plans sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.status = 'active'
      ORDER BY u.first_name, u.last_name, sp.plan_name
    `);

    const planIds = activePlans.map(p => p.plan_id);
    let defaultsMap = {};
    if (planIds.length > 0) {
      const { rows: defaults } = await query(`
        SELECT id, plan_id, missed_date, penalty_amount, resolved
        FROM defaults
        WHERE plan_id = ANY($1) AND resolved = FALSE
        ORDER BY missed_date DESC
      `, [planIds]);
      for (const d of defaults) {
        if (!defaultsMap[d.plan_id]) defaultsMap[d.plan_id] = [];
        defaultsMap[d.plan_id].push(d);
      }
    }

    const watDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
    const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][watDate.getDay()];

    const userMap = {};

    for (const plan of activePlans) {
      const config = PLAN_CONFIG[plan.plan_name];
      if (!config) continue;

      const perAccountAmount = config.amount;
      const numAccounts = plan.number_of_accounts || 1;
      const expectedInstallment = perAccountAmount * numAccounts;
      const lastPaymentDate = plan.last_payment_date;
      const currentAmount = parseFloat(plan.current_amount || 0);
      const targetAmount = parseFloat(plan.target_amount || 0);
      const startDate = new Date(plan.start_date);
      const daysSinceStart = Math.floor((watDate - startDate) / (1000 * 60 * 60 * 24));
      const durationDays = config.duration_days || 0;
      const isMatured = daysSinceStart >= durationDays;

      const progressPct = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

      const planDefaults = defaultsMap[plan.plan_id] || [];

      const entry = {
        plan_id: plan.plan_id,
        plan_name: plan.plan_name,
        number_of_accounts: numAccounts,
        per_account_amount: perAccountAmount,
        expected_installment: expectedInstallment,
        start_date: plan.start_date,
        maturity_date: plan.maturity_date,
        preferred_day: plan.preferred_day,
        last_payment_date: lastPaymentDate,
        current_amount: currentAmount,
        target_amount: targetAmount,
        progress_pct: progressPct,
        defaults: planDefaults,
        days_since_start: daysSinceStart,
        duration_days: durationDays,
        is_matured: isMatured,
      };

      const uid = plan.user_id;
      if (!userMap[uid]) {
        userMap[uid] = {
          user_id: uid,
          first_name: plan.first_name,
          last_name: plan.last_name,
          email: plan.email,
          plans: [],
          matured_count: 0,
          default_count: 0,
        };
      }
      userMap[uid].plans.push(entry);
      if (isMatured) userMap[uid].matured_count++;
      if (planDefaults.length > 0) userMap[uid].default_count += planDefaults.length;
    }

    const result = Object.values(userMap).sort((a, b) => {
      if (b.matured_count !== a.matured_count) return b.matured_count - a.matured_count;
      return a.first_name.localeCompare(b.first_name);
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching due payments:', error);
    res.status(500).json({ message: 'Server error fetching due payments' });
  }
};

export const getClearancePlans = async (req, res) => {
  try {
    const { status } = req.query;
    const validStatuses = ['pending_clearance', 'pending_settlement', 'settled'];
    const statusFilter = status && validStatuses.includes(status)
      ? status
      : ['pending_clearance', 'pending_settlement'];
    const { rows } = await query(`
      SELECT
        sp.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM savings_plans sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.status = ANY($1::text[])
        AND sp.clearance_required = TRUE
      ORDER BY sp.updated_at DESC
    `, [Array.isArray(statusFilter) ? statusFilter : [statusFilter]]);
    res.json(rows.map(r => ({
      ...r,
      accounts_cleared: parseInt(r.accounts_cleared || 0, 10),
      number_of_accounts: r.number_of_accounts || 1,
    })));
  } catch (error) {
    console.error('Error fetching clearance plans:', error);
    res.status(500).json({ message: 'Server error fetching clearance plans' });
  }
};

export const adminSettleClearance = async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: 'Plan ID required' });

    const client = await getClient();
    try {
      const { rows: plans } = await client.query('SELECT * FROM savings_plans WHERE id = $1 FOR UPDATE', [planId]);
      if (plans.length === 0) throw new Error('Plan not found');
      const plan = plans[0];

      if (plan.status !== 'pending_settlement') {
        throw new Error('Plan is not in pending settlement status');
      }

      await client.query('BEGIN');

      const { rows: updated } = await client.query(`
        UPDATE savings_plans
        SET status = 'settled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *
      `, [planId]);

      const accounts = plan.number_of_accounts || 1;
      const alreadyCleared = parseInt(plan.accounts_cleared || 0, 10);
      const remainingFee = (accounts - alreadyCleared) * 3000;

      const reference = `SETTLE-${Date.now()}`;
      await client.query(`
        INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
        VALUES ($1, $2, 'admin_settlement', $3, 'completed', $4)
      `, [plan.user_id, planId, remainingFee, reference]);

      const msg = `${plan.plan_name} program has been settled. Your payout is now available.`;
      await client.query(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, 'Plan Settled', $2, 'payout')
      `, [plan.user_id, msg]);

      await logAudit(req.user.id, 'SETTLE_CLEARANCE', 'savings_plan', planId, {});
      await client.query('COMMIT');

      res.json({ message: 'Plan cleared and settled successfully', plan: updated[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error settling clearance:', error);
    res.status(500).json({ message: 'Server error settling clearance' });
  }
};
