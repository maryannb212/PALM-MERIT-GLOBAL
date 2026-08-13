import { query, getClient } from '../config/db.js';
import { createNotification } from '../models/notificationModel.js';
import { logAudit } from '../models/auditModel.js';
import { processCompletedPayment, createTransaction } from '../models/transactionModel.js';
import * as withdrawalController from './withdrawalController.js';
import jsonwebtoken from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';

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
        (SELECT COUNT(*) FROM referral_codes rc WHERE rc.user_id = u.id AND rc.used_by_user_id IS NOT NULL)
        AS downline_count,
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

    // Fetch downlines — each referral code usage is a separate entry
    const { rows: downlines } = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at, rc.code as used_code, rc.updated_at as used_at
      FROM referral_codes rc
      JOIN users u ON u.id = rc.used_by_user_id
      WHERE rc.user_id = $1 AND rc.used_by_user_id IS NOT NULL
      ORDER BY rc.created_at DESC
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

    // Compute cycle information per plan (duration, elapsed days, completion, messages)
    for (const plan of user.savings_plans) {
      try {
        // determine contribution start date from earliest savings transaction if present
        const { rows: contribRows } = await query(
          `SELECT MIN(created_at) AS contribution_date FROM transactions WHERE plan_id = $1 AND type = 'savings'`,
          [plan.id]
        );
        const contributionDate = contribRows[0].contribution_date ? new Date(contribRows[0].contribution_date) : (plan.start_date ? new Date(plan.start_date) : null);

        // duration mapping (days) - align with weekly/daily config
        const durationMap = {
          'CREST': 84,        // 12 weeks
          'SILVER': 350,      // 50 weeks
          'GOLDEN_BASKET': 350,
          'ISUSU': 30         // 30 days
        };
        const msPerDay = 24 * 60 * 60 * 1000;
        const now = new Date();
        const durationDays = durationMap[plan.plan_name] || 0;

        plan.cycleDurationDays = durationDays;
        if (contributionDate) {
          const elapsed = Math.floor((now.getTime() - new Date(contributionDate).getTime()) / msPerDay);
          plan.cycleDaysElapsed = elapsed;
        } else {
          plan.cycleDaysElapsed = null;
        }

        // expected contributions based on plan config
        const cfg = {
          'CREST': { amount: 4000, weeks: 12 },
          'SILVER': { amount: 1500, weeks: 50 },
          'GOLDEN_BASKET': { amount: 2000, weeks: 50 },
          'ISUSU': { amount: 500, days: 30 }
        };
        const c = cfg[plan.plan_name];
        const numAccounts = plan.number_of_accounts || 1;
        let expectedContributions = 0;
        if (c) {
          if (c.days) expectedContributions = c.amount * numAccounts * c.days;
          else expectedContributions = c.amount * numAccounts * c.weeks;
        }

        const currentAmount = parseFloat(plan.current_amount || 0);
        const contributionsComplete = currentAmount >= expectedContributions;

        const cycleTimeReached = (plan.cycleDaysElapsed !== null && durationDays > 0) ? (plan.cycleDaysElapsed >= durationDays) : false;

        plan.cycleCompleted = contributionsComplete && cycleTimeReached;

        if (plan.cycleCompleted) {
          // compute clearance availability date (next 6 days)
          const clearanceDate = new Date(now.getTime() + (6 * msPerDay));
          const clearanceDateStr = clearanceDate.toLocaleDateString('en-NG');
          plan.computed_status = 'completed';
          plan.completionMessage = `Savings cycle completed — congratulations 🍷 🎉. Clearance will be available on ${clearanceDateStr}.`;
          plan.clearanceAvailableDate = clearanceDateStr;
        } else {
          plan.computed_status = plan.status;
        }
      } catch (err) {
        console.error('Error computing cycle info for plan', plan.id, err);
        plan.cycleDurationDays = null;
        plan.cycleDaysElapsed = null;
        plan.cycleCompleted = false;
        plan.computed_status = plan.status;
      }
    }

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
 * Fast-forward or set a savings plan's clearance date for testing.
 * POST /api/admin/users/:userId/fast-forward-clearance
 * Body: { planId: uuid, days?: integer, newDate?: ISOString }
 */
export const fastForwardClearance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { planId, days, newDate } = req.body;

    if (!planId) return res.status(400).json({ message: 'planId is required' });

    // Validate ownership
    const { rows: planRows } = await query('SELECT id, user_id, clearance_date FROM savings_plans WHERE id = $1 AND user_id = $2', [planId, userId]);
    if (planRows.length === 0) return res.status(404).json({ message: 'Plan not found for user' });

    let updated;
    // Normalize days if provided as string
    let parsedDays = null;
    if (typeof days === 'string' && days.trim() !== '') {
      const dnum = parseInt(days, 10);
      if (!isNaN(dnum)) parsedDays = dnum;
    } else if (typeof days === 'number' && Number.isInteger(days)) {
      parsedDays = days;
    }

    if (newDate) {
      // Accept YYYY-MM-DD or full ISO
      let nd = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(newDate.trim())) {
        // Treat as local date at midnight (UTC)
        nd = new Date(newDate.trim() + 'T00:00:00.000Z');
      } else {
        nd = new Date(newDate);
      }
      if (!nd || isNaN(nd.getTime())) return res.status(400).json({ message: 'Invalid newDate' });
      const iso = nd.toISOString();
      const { rows } = await query('UPDATE savings_plans SET clearance_date = $1, end_date = $1, maturity_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [iso, planId]);
      updated = rows[0];
    } else if (parsedDays !== null) {
      // Advance end_date/clearance_date by parsedDays; if null, start from now
      const base = planRows[0].end_date ? new Date(planRows[0].end_date) : (planRows[0].clearance_date ? new Date(planRows[0].clearance_date) : new Date());
      const newDt = new Date(base.getTime() + (parsedDays * 24 * 60 * 60 * 1000));
      const iso = newDt.toISOString();
      const { rows } = await query('UPDATE savings_plans SET clearance_date = $1, end_date = $1, maturity_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [iso, planId]);
      updated = rows[0];
    } else {
      return res.status(400).json({ message: 'Either days (integer) or newDate (ISO or YYYY-MM-DD) is required' });
    }

    // After updating dates, if plan has completed required contributions, transition status and notify user
    try {
      const { rows: refreshed } = await query('SELECT * FROM savings_plans WHERE id = $1', [planId]);
      const planRow = refreshed[0];
      if (planRow) {
        // Compute expected contributions similar to approveEligibility
        const cfg = {
          'CREST': { amount: 4000, weeks: 12 },
          'SILVER': { amount: 1500, weeks: 50 },
          'GOLDEN_BASKET': { amount: 2000, weeks: 50 },
          'ISUSU': { amount: 500, days: 30 }
        };
        const c = cfg[planRow.plan_name];
        const numAccounts = planRow.number_of_accounts || 1;
        let expected = 0;
        if (c) {
          if (c.days) expected = c.amount * numAccounts * c.days;
          else expected = c.amount * numAccounts * c.weeks;
        }

        const currentAmount = parseFloat(planRow.current_amount || 0);
        if (expected > 0 && currentAmount >= expected) {
          // Contributions complete — if CREST/SILVER require clearance, move to pending_clearance
          if (['CREST', 'SILVER'].includes(planRow.plan_name)) {
            await query("UPDATE savings_plans SET status = 'pending_clearance', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [planId]);
            const accounts = planRow.number_of_accounts || 1;
            const totalFee = accounts * 3000;
            const msg = `${planRow.plan_name} program has passed eligibility review. Pay ₦${totalFee.toLocaleString()} clearance fee (₦3,000 × ${accounts} account(s)) to proceed to settlement.`;
            await query(`INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'Clearance Required', $2, 'clearance')`, [planRow.user_id, msg]);
            const { rows: finalRows } = await query('SELECT * FROM savings_plans WHERE id = $1', [planId]);
            updated = finalRows[0];
            await logAudit(req.user.id, 'AUTO_APPROVE_ELIGIBILITY_FASTFORWARD', 'savings_plan', planId, { reason: 'fast-forward', plan: planRow.plan_name });
          } else {
            // For other plans, mark as pending (approved) and notify
            let payoutDate = null;
            const planStart = new Date(planRow.start_date);
            if (planRow.plan_name === 'GOLDEN_BASKET') {
              payoutDate = new Date(planStart.getTime() + (364 * 24 * 60 * 60 * 1000));
            } else {
              payoutDate = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000));
            }
            await query('UPDATE savings_plans SET status = $1, payout_date = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', ['pending', payoutDate, planId]);
            const dateStr = payoutDate ? new Date(payoutDate).toLocaleDateString('en-NG') : 'the scheduled date';
            const msg = `${planRow.plan_name} program has been approved for payout. Settlement will be processed on ${dateStr}.`;
            await query(`INSERT INTO notifications (user_id, title, message, type) VALUES ($1, 'Plan Approved for Payout', $2, 'payout')`, [planRow.user_id, msg]);
            const { rows: finalRows } = await query('SELECT * FROM savings_plans WHERE id = $1', [planId]);
            updated = finalRows[0];
            await logAudit(req.user.id, 'AUTO_APPROVE_ELIGIBILITY_FASTFORWARD', 'savings_plan', planId, { reason: 'fast-forward', plan: planRow.plan_name, payoutDate });
          }
        }
      }
    } catch (e) {
      console.error('Error post-processing fast-forward eligibility:', e);
    }

    await logAudit(req.user.id, 'FAST_FORWARD_CLEARANCE', 'savings_plan', planId, { userId, days, newDate });

    res.json({ message: 'Clearance date updated', plan: updated });
  } catch (error) {
    console.error('Error fast-forwarding clearance:', error);
    res.status(500).json({ message: 'Failed to fast-forward clearance' });
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
        (SELECT COUNT(*) FROM referral_codes WHERE used_by_user_id IS NOT NULL)
        as total_downlines,
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
  const t = await getClient();
  try {
    const { id } = req.params;
    const { status, adminReply } = req.body;

    await t.query('BEGIN');

    if (status) {
      const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        await t.query('ROLLBACK');
        return res.status(400).json({ message: 'Invalid status' });
      }
      await t.query('UPDATE tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
    }

    // If adminReply provided, attempt to persist it in ticket_messages table if exists
    if (adminReply) {
      const { rows: existsRows } = await t.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_messages') as exists");
      const exists = existsRows[0]?.exists;
      if (exists) {
        await t.query('INSERT INTO ticket_messages (ticket_id, sender, message, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)', [id, 'admin', adminReply]);
      } else {
        // Fallback: add a notification to the user
        const tr = await t.query('SELECT user_id, title FROM tickets WHERE id = $1', [id]);
        if (tr.rows.length > 0) {
          const ticket = tr.rows[0];
          await createNotification(ticket.user_id, 'SUPPORT', 'Support Ticket Update', `Admin replied to your ticket: ${adminReply}`);
        }
      }
    }

    await t.query('COMMIT');
    await logAudit(req.user.id, 'UPDATE_TICKET', 'ticket', id, { status, adminReply });
    const { rows: updated } = await query('SELECT * FROM tickets WHERE id = $1', [id]);
    res.json({ message: 'Ticket updated', ticket: updated[0] });
  } catch (error) {
    console.error('Error updating ticket:', error);
    try { await t.query('ROLLBACK'); } catch (e) {}
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
    const hasDownlines = req.query.hasDownlines === 'true';

    const downlineFilterJoin = hasDownlines ? `
      WHERE EXISTS (SELECT 1 FROM users sub WHERE sub.referred_by = u.id AND sub.id != u.id)
         OR EXISTS (SELECT 1 FROM referral_codes rc WHERE rc.user_id = u.id AND rc.used_by_user_id IS NOT NULL)
    ` : '';

    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM users u ${downlineFilterJoin}`
    );
    const totalUsers = parseInt(count, 10);

    // Aggregate stats for the header
    const { rows: [{ count: total_unlocks }] } = await query(
      `SELECT COUNT(*) FROM users WHERE referral_unlock_date IS NOT NULL AND referral_unlock_date <= NOW()`
    );
    const { rows: [{ count: total_referrals_agg }] } = await query(
      `SELECT COUNT(*) FROM referral_codes WHERE used_by_user_id IS NOT NULL`
    );
    const totalReferralsAgg = parseInt(total_referrals_agg, 10) || 0;
    const totalUnlocksAgg = parseInt(total_unlocks, 10) || 0;

    const { rows: users } = await query(`
      SELECT id, first_name, last_name, email, phone, referral_code, referred_by, referral_unlock_date, referral_expiry_date, status, created_at
      FROM users u
      ${downlineFilterJoin}
      ORDER BY u.created_at DESC
    `);

    // Pre-fetch ALL individual code usages (each = one downline entry)
    const { rows: allCodeUsages } = await query(`
      SELECT rc.user_id, rc.used_by_user_id, rc.code, rc.updated_at,
             u.first_name, u.last_name, u.email, u.phone, u.status
      FROM referral_codes rc
      JOIN users u ON u.id = rc.used_by_user_id
      WHERE rc.used_by_user_id IS NOT NULL
    `);
    const codeUsagesByUser = {};
    for (const cu of allCodeUsages) {
      if (!codeUsagesByUser[cu.user_id]) codeUsagesByUser[cu.user_id] = [];
      codeUsagesByUser[cu.user_id].push(cu);
    }

    // Pre-fetch ALL savings plans grouped by user
    const { rows: allPlans } = await query(
      `SELECT user_id, plan_name, current_amount FROM savings_plans`
    );
    const plansByUser = {};
    for (const p of allPlans) {
      if (!plansByUser[p.user_id]) plansByUser[p.user_id] = [];
      plansByUser[p.user_id].push(p);
    }

    // Pre-fetch ALL referral codes grouped by owner
    const { rows: allCodes } = await query(`
      SELECT rc.user_id, rc.code, rc.status, rc.unlock_date, rc.used_by_user_id, rc.created_at, rc.updated_at,
             rc.plan_id,
             sp.plan_name,
             u.first_name AS used_by_first_name, u.last_name AS used_by_last_name, u.email AS used_by_email
      FROM referral_codes rc
      LEFT JOIN users u ON rc.used_by_user_id = u.id
      LEFT JOIN savings_plans sp ON rc.plan_id = sp.id
      ORDER BY rc.created_at DESC
    `);
    const codesByUser = {};
    for (const c of allCodes) {
      if (!codesByUser[c.user_id]) codesByUser[c.user_id] = [];
      codesByUser[c.user_id].push(c);
    }

    const result = [];
    for (const u of users) {
      const entries = codeUsagesByUser[u.id] || [];
      let activeQualifiedCount = 0;
      const downlineDetails = [];

      for (const entry of entries) {
        const plans = plansByUser[entry.used_by_user_id] || [];
        const isSuspended = entry.status && entry.status.toLowerCase() !== 'active';
        const silverPlans = plans.filter(p => p.plan_name === 'SILVER');
        const totalSilverPaid = silverPlans.reduce((sum, p) => sum + parseFloat(p.current_amount || 0), 0);

        let referralStatus = 'inactive';
        if (isSuspended) {
          referralStatus = 'disqualified';
        } else if (plans.length === 0) {
          referralStatus = 'inactive';
        } else if (silverPlans.length > 0 && totalSilverPaid > 0) {
          referralStatus = 'qualified';
          activeQualifiedCount++;
        } else {
          referralStatus = 'pending';
        }

        downlineDetails.push({
          id: entry.used_by_user_id,
          firstName: entry.first_name,
          lastName: entry.last_name,
          email: entry.email,
          referralStatus,
          usedCode: entry.code,
          usedAt: entry.updated_at
        });
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
        downlinesCount: entries.length,
        activeQualifiedCount,
        isEligible: activeQualifiedCount >= 2,
        downlines: downlineDetails,
        referralCodes: (codesByUser[u.id] || []).map(c => ({
          code: c.code,
          status: c.status,
          unlockDate: c.unlock_date,
          planName: c.plan_name || 'N/A',
          usedBy: c.used_by_user_id ? `${c.used_by_first_name} ${c.used_by_last_name}` : null,
          usedByEmail: c.used_by_email || null,
          usedAt: c.updated_at,
          createdAt: c.created_at
        }))
      });
    }

    res.json({
      users: result,
      stats: {
        totalReferrals: totalReferralsAgg,
        totalUnlocks: totalUnlocksAgg
      },
      pagination: {
        total: totalUsers,
        totalPages: 1
      }
    });
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

    let newStatus = 'pending';
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
      } else if (newStatus === 'pending') {
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

/**
 * Retry processing of a logged webhook event (admin action)
 * POST /api/admin/webhook-logs/:id/retry
 */
export const retryWebhookLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('SELECT * FROM webhook_logs WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Webhook log not found' });

    const log = rows[0];
    const payload = log.payload || null;
    const source = log.source || 'paystack';

    if (source === 'paystack') {
      const reference = log.reference || (payload && payload.data && payload.data.reference) || null;
      if (!reference) return res.status(400).json({ message: 'No reference available to retry' });

      // Try to re-verify with Paystack if configured
      let verifiedAmount = null;
      let gatewayRef = null;
      const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim().replace(/^\"|\"$/g, '');
      if (secret) {
        try {
          const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${secret}` },
            timeout: 10000
          });
          const data = verifyRes.data?.data;
          if (data && data.status === 'success') {
            verifiedAmount = data.amount / 100;
            gatewayRef = data.id?.toString() || null;
          }
        } catch (err) {
          console.warn('Paystack verify failed during retry:', err.message);
        }
      }

      const result = await processCompletedPayment(reference, verifiedAmount, gatewayRef, 'paystack');

      await query("UPDATE webhook_logs SET status = 'processed', note = COALESCE(note, '') || ' | retried by admin' WHERE id = $1", [id]);
      return res.json({ message: 'Retry processed', result });
    }

    if (source === 'lotus') {
      // lotus payload should contain data.amount and reserved_account details for VAs
      const p = payload || {};
      const accountNumber = p.data?.reserved_account?.account_details?.account_number || null;
      const reference = log.reference || p.data?.reference || p.reference || null;
      const rawAmount = p.data?.amount || p.amount || 0;
      const amount = Number(rawAmount || 0);

      if (!reference) return res.status(400).json({ message: 'No reference available to retry' });

      if (accountNumber && amount > 0) {
        // find user
        const { rows: userRows } = await query('SELECT id FROM users WHERE virtual_account_number = $1', [accountNumber]);
        const user = userRows[0];
        if (!user) return res.status(404).json({ message: 'User for VA not found' });

        // ensure transaction exists
        const tx = await query('SELECT * FROM transactions WHERE reference = $1', [reference]);
        if (!tx.rows[0]) {
          await createTransaction(user.id, null, 'wallet_topup', amount, reference, 'lotus');
        }

        const result = await processCompletedPayment(reference, amount, reference, 'lotus');
        await query("UPDATE webhook_logs SET status = 'processed', note = COALESCE(note, '') || ' | retried by admin' WHERE id = $1", [id]);
        return res.json({ message: 'Retry processed', result });
      }

      return res.status(400).json({ message: 'Lotus payload missing VA account or amount' });
    }

    return res.status(400).json({ message: 'Unsupported webhook source for retry' });
  } catch (error) {
    console.error('Error retrying webhook log:', error);
    try { await query("UPDATE webhook_logs SET status = 'error', note = COALESCE(note, '') || ' | retry failed: ' || $2 WHERE id = $1", [req.params.id, String(error.message)]); } catch (e) {}
    res.status(500).json({ message: 'Failed to retry webhook' });
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

export const impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    const { rows } = await query(`
      SELECT id, first_name, last_name, email, phone, role, has_paid_membership, kyc_status,
             profile_image, referral_code, referral_unlock_date, referral_expiry_date, status, created_at
      FROM users WHERE id = $1
    `, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const u = rows[0];

    const token = jsonwebtoken.sign(
      { id: u.id, impersonatedBy: adminId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '2h' }
    );

    res.json({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      hasPaidMembership: u.has_paid_membership,
      kycStatus: u.kyc_status,
      profileImage: u.profile_image,
      referralCode: u.referral_code,
      referralUnlockDate: u.referral_unlock_date,
      referralExpiryDate: u.referral_expiry_date,
      status: u.status,
      createdAt: u.created_at,
      token,
      impersonatedBy: adminId
    });
  } catch (error) {
    console.error('Error impersonating user:', error);
    res.status(500).json({ message: 'Server error during impersonation' });
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
        throw new Error('Plan is not pending admin approval');
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

      const msg = `${plan.plan_name} program has been approved and paid.`;
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

/**
 * Get account creation stats with date filtering
 * GET /api/admin/daily-accounts?filter=today|yesterday|thisMonth|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const getDailyAccountStats = async (req, res) => {
  try {
    const filter = req.query.filter || 'today';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate, endDate;

    if (filter === 'today') {
      startDate = new Date(today);
      endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 1);
    } else if (filter === 'yesterday') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(today);
    } else if (filter === 'thisMonth') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 1);
    } else if (filter === 'custom' && req.query.from && req.query.to) {
      startDate = new Date(req.query.from);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(req.query.to);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      startDate = new Date(today);
      endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 1);
    }

    const { rows: accounts } = await query(`
      SELECT 
        sp.id,
        sp.user_id,
        sp.plan_name,
        sp.number_of_accounts,
        sp.current_amount,
        sp.created_at,
        sp.status,
        u.first_name,
        u.last_name,
        u.email
      FROM savings_plans sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.created_at >= $1 AND sp.created_at < $2
      ORDER BY sp.created_at DESC
    `, [startDate.toISOString(), endDate.toISOString()]);

    const totalAccounts = accounts.reduce((sum, a) => sum + (a.number_of_accounts || 1), 0);

    res.json({
      accounts,
      total: accounts.length,
      totalAccounts,
      filter,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching daily account stats:', error);
    res.status(500).json({ message: 'Server error fetching daily account stats' });
  }
};

/**
 * Get a specific user's referral codes (with used_by info)
 * GET /api/admin/codes/users/:id
 * Query: ?status=available|used|all (default: all)
 */
export const getUserCodes = async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.query.status || 'all';

    const userResult = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.referral_code, u.created_at,
              r.first_name AS upline_first_name, r.last_name AS upline_last_name, r.email AS upline_email
       FROM users u
       LEFT JOIN users r ON u.referred_by = r.id
       WHERE u.id = $1`,
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Auto-unlock codes past their unlock_date (same as user-facing getUserReferralCodes)
    await query(
      `UPDATE referral_codes SET status = 'available', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status = 'locked' AND unlock_date IS NOT NULL AND unlock_date <= NOW()`,
      [id]
    );

    // Auto-expire codes past their expires_at
    await query(
      `UPDATE referral_codes SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status IN ('available', 'locked') AND expires_at IS NOT NULL AND expires_at <= NOW()`,
      [id]
    );

    let statusFilter = '';
    const params = [id];
    if (status === 'available') {
      statusFilter = "AND rc.status = 'available'";
    } else if (status === 'used') {
      statusFilter = "AND rc.status = 'used'";
    } else if (status === 'locked') {
      statusFilter = "AND rc.status = 'locked'";
    } else if (status === 'expired') {
      statusFilter = "AND rc.status = 'expired'";
    }

    const codesResult = await query(
      `SELECT 
        rc.id, rc.code, rc.status, rc.plan_id, rc.unlock_date, rc.expires_at,
        rc.used_by_user_id, rc.created_at, rc.updated_at AS used_at,
        bu.first_name AS used_by_name, bu.last_name AS used_by_last_name, bu.email AS used_by_email,
        sp.plan_name, sp.number_of_accounts
      FROM referral_codes rc
      LEFT JOIN users bu ON rc.used_by_user_id = bu.id
      LEFT JOIN savings_plans sp ON rc.plan_id = sp.id
      WHERE rc.user_id = $1 ${statusFilter}
      ORDER BY rc.created_at DESC`,
      params
    );

    res.json({
      user: userResult.rows[0],
      codes: codesResult.rows
    });
  } catch (error) {
    console.error('Error fetching user codes:', error);
    res.status(500).json({ message: 'Server error fetching user codes' });
  }
};

/**
 * Assign an available referral code to a target user (mark as used)
 * POST /api/admin/referral-codes/:codeId/assign
 * Body: { targetUserId: UUID }
 */
export const assignReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const codeResult = await client.query(
        `SELECT rc.*, u.first_name, u.last_name, u.email
         FROM referral_codes rc
         JOIN users u ON rc.user_id = u.id
         WHERE rc.id = $1 FOR UPDATE`,
        [codeId]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Referral code not found' });
      }

      const code = codeResult.rows[0];
      if (code.status !== 'available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Code is already ${code.status}` });
      }

      const targetCheck = await client.query(`SELECT id, first_name, last_name FROM users WHERE id = $1`, [targetUserId]);
      if (targetCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Target user not found' });
      }

      await client.query(
        `UPDATE referral_codes SET status = 'used', used_by_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [targetUserId, codeId]
      );

      await client.query('COMMIT');

      res.json({
        message: `Code ${code.code} assigned to ${targetCheck.rows[0].first_name} ${targetCheck.rows[0].last_name}`,
        code: { ...code, status: 'used', used_by_user_id: targetUserId }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error assigning referral code:', error);
    res.status(500).json({ message: 'Server error assigning referral code' });
  }
};

/**
 * Unlock a locked referral code → set status to 'available', clear unlock_date
 * PUT /api/admin/referral-codes/:codeId/unlock
 */
export const unlockReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const codeResult = await client.query(
        `SELECT rc.*, u.first_name, u.last_name
         FROM referral_codes rc
         JOIN users u ON rc.user_id = u.id
         WHERE rc.id = $1 FOR UPDATE`,
        [codeId]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Referral code not found' });
      }

      const code = codeResult.rows[0];
      if (code.status !== 'locked') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Can only unlock locked codes. Current status: ${code.status}` });
      }

      await client.query(
        `UPDATE referral_codes SET status = 'available', unlock_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [codeId]
      );

      await client.query('COMMIT');

      res.json({
        message: `Code ${code.code} unlocked successfully`,
        code: { ...code, status: 'available', unlock_date: null }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error unlocking referral code:', error);
    res.status(500).json({ message: 'Server error unlocking referral code' });
  }
};

/**
 * Reactivate an expired referral code for 48 hours
 * PUT /api/admin/referral-codes/:codeId/reactivate
 */
export const reactivateReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const codeResult = await client.query(
        `SELECT rc.*, u.first_name, u.last_name
         FROM referral_codes rc
         JOIN users u ON rc.user_id = u.id
         WHERE rc.id = $1 FOR UPDATE`,
        [codeId]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Referral code not found' });
      }

      const code = codeResult.rows[0];
      if (code.status !== 'expired') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Can only reactivate expired codes. Current status: ${code.status}` });
      }

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await client.query(
        `UPDATE referral_codes SET status = 'available', expires_at = $1, unlock_date = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [expiresAt, codeId]
      );

      await client.query('COMMIT');

      res.json({
        message: `Code ${code.code} reactivated for 48 hours`,
        code: { ...code, status: 'available', expires_at: expiresAt, unlock_date: null }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reactivating referral code:', error);
    res.status(500).json({ message: 'Server error reactivating referral code' });
  }
};

/**
 * Lock an available referral code → set status to 'locked'
 * PUT /api/admin/referral-codes/:codeId/lock
 * Body: { unlockDate: ISO string (optional) }
 */
export const lockReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { unlockDate } = req.body;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const codeResult = await client.query(
        `SELECT rc.*, u.first_name, u.last_name
         FROM referral_codes rc
         JOIN users u ON rc.user_id = u.id
         WHERE rc.id = $1 FOR UPDATE`,
        [codeId]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Referral code not found' });
      }

      const code = codeResult.rows[0];
      if (code.status !== 'available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Can only lock available codes. Current status: ${code.status}` });
      }

      const lockDate = unlockDate || null;
      await client.query(
        `UPDATE referral_codes SET status = 'locked', unlock_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [lockDate, codeId]
      );

      await client.query('COMMIT');

      res.json({
        message: `Code ${code.code} locked successfully`,
        code: { ...code, status: 'locked', unlock_date: lockDate }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error locking referral code:', error);
    res.status(500).json({ message: 'Server error locking referral code' });
  }
};

/**
 * Unassign a used referral code → clear used_by_user_id, set status to 'available'
 * PUT /api/admin/referral-codes/:codeId/unassign
 */
export const unassignReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const codeResult = await client.query(
        `SELECT rc.*, u.first_name AS owner_name, u.last_name AS owner_last_name
         FROM referral_codes rc
         JOIN users u ON rc.user_id = u.id
         WHERE rc.id = $1 FOR UPDATE`,
        [codeId]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Referral code not found' });
      }

      const code = codeResult.rows[0];
      if (code.status !== 'used') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Can only unassign used codes. Current status: ${code.status}` });
      }

      await client.query(
        `UPDATE referral_codes SET used_by_user_id = NULL, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [codeId]
      );

      await client.query('COMMIT');

      res.json({
        message: `Code ${code.code} unassigned successfully`,
        code: { ...code, status: 'available', used_by_user_id: null }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error unassigning referral code:', error);
    res.status(500).json({ message: 'Server error unassigning referral code' });
  }
};

/**
 * Delete a referral code permanently
 * DELETE /api/admin/referral-codes/:codeId
 */
export const deleteReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const codeResult = await client.query(
        `SELECT rc.*, u.first_name AS owner_name, u.last_name AS owner_last_name,
                sp.plan_name, sp.status AS plan_status, sp.user_id AS plan_user_id,
                sp.number_of_accounts, sp.current_amount, sp.target_amount
         FROM referral_codes rc
         JOIN users u ON rc.user_id = u.id
         LEFT JOIN savings_plans sp ON rc.plan_id = sp.id
         WHERE rc.id = $1`,
        [codeId]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Referral code not found' });
      }

      const code = codeResult.rows[0];

      let planDeleted = false;
      let transactionsDeleted = 0;
      let defaultsDeleted = 0;
      let payoutsDeleted = 0;

      if (code.plan_id) {
        const remainingResult = await client.query(
          'SELECT COUNT(*)::int AS count FROM referral_codes WHERE plan_id = $1 AND id != $2',
          [code.plan_id, codeId]
        );
        const remainingCodes = remainingResult.rows[0].count;

        if (remainingCodes === 0) {
          await client.query('SAVEPOINT cleanup');

          try {
            const txResult = await client.query(
              'DELETE FROM transactions WHERE plan_id = $1',
              [code.plan_id]
            );
            transactionsDeleted = txResult.rowCount;

            const defResult = await client.query(
              'DELETE FROM defaults WHERE plan_id = $1',
              [code.plan_id]
            );
            defaultsDeleted = defResult.rowCount;

            const payResult = await client.query(
              'DELETE FROM payouts WHERE plan_id = $1',
              [code.plan_id]
            );
            payoutsDeleted = payResult.rowCount;

            await client.query(
              'DELETE FROM referral_codes WHERE plan_id = $1 AND id != $2',
              [code.plan_id, codeId]
            );

            await client.query(
              'DELETE FROM savings_plans WHERE id = $1',
              [code.plan_id]
            );
            planDeleted = true;

            await client.query('RELEASE SAVEPOINT cleanup');
          } catch (spErr) {
            console.error('Plan cleanup failed, rolling back cleanup only:', spErr.message, spErr.code, spErr.detail);
            await client.query('ROLLBACK TO SAVEPOINT cleanup');
          }
        } else {
          await client.query(
            `UPDATE savings_plans
             SET number_of_accounts = GREATEST(number_of_accounts - 1, 1),
                 accounts_cleared = LEAST(accounts_cleared, GREATEST(number_of_accounts - 1, 1)),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [code.plan_id]
          );
        }
      }

      await client.query('DELETE FROM referral_codes WHERE id = $1', [codeId]);

      await client.query('COMMIT');

      const summary = [`Code ${code.code} deleted permanently`];
      if (planDeleted) {
        summary.push(`Savings plan (${code.plan_name}) deleted`);
        if (transactionsDeleted > 0) summary.push(`${transactionsDeleted} transaction(s) removed`);
        if (defaultsDeleted > 0) summary.push(`${defaultsDeleted} default(s) removed`);
        if (payoutsDeleted > 0) summary.push(`${payoutsDeleted} payout(s) removed`);
      } else if (code.plan_id) {
        summary.push(`Plan accounts reduced`);
      }

      res.json({
        message: summary.join('. '),
        code,
        planDeleted,
        transactionsDeleted,
        defaultsDeleted,
        payoutsDeleted
      });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { console.error('ROLLBACK failed:', rbErr.message); }
      console.error('Error deleting referral code:', e.message, e.code, e.detail);
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting referral code:', error.message, error.code, error.detail);
    res.status(500).json({ message: error.message || 'Server error deleting referral code' });
  }
};

/**
 * Reassign a used referral code to a different target user
 * PUT /api/admin/referral-codes/:codeId/reassign
 * Body: { targetUserId: UUID }
 */
export const reassignReferralCode = async (req, res) => {
  try {
    const { codeId } = req.params;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const codeResult = await client.query(
        `SELECT rc.*, u.first_name AS owner_name, u.last_name AS owner_last_name
         FROM referral_codes rc
         JOIN users u ON rc.user_id = u.id
         WHERE rc.id = $1 FOR UPDATE`,
        [codeId]
      );

      if (codeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Referral code not found' });
      }

      const code = codeResult.rows[0];
      if (code.status !== 'used') {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Can only reassign used codes. Current status: ${code.status}` });
      }

      const targetCheck = await client.query(`SELECT id, first_name, last_name FROM users WHERE id = $1`, [targetUserId]);
      if (targetCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Target user not found' });
      }

      await client.query(
        `UPDATE referral_codes SET used_by_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [targetUserId, codeId]
      );

      await client.query('COMMIT');

      res.json({
        message: `Code ${code.code} reassigned to ${targetCheck.rows[0].first_name} ${targetCheck.rows[0].last_name}`,
        code: { ...code, used_by_user_id: targetUserId }
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reassigning referral code:', error);
    res.status(500).json({ message: 'Server error reassigning referral code' });
  }
};
