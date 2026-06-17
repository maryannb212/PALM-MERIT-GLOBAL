import { createSavingsPlan, getUserSavingsPlans } from '../models/savingsModel.js';
import { getClient, query } from '../config/db.js';
import { createWalletLedgerEntry } from '../models/transactionModel.js';
import { isReferrerEligibleForMultiplier } from '../helpers/referralHelper.js';
import { createReferralCodeForPlan } from '../models/referralModel.js';

export const subscribeToPlan = async (req, res) => {
  try {
    const { planName, targetAmount, numberOfAccounts, referralCode } = req.body;
    const userId = req.user.id;

    if (!planName || !targetAmount) {
      return res.status(400).json({ message: 'Plan name and target amount are required' });
    }

    const validPlans = ['CREST', 'SILVER', 'GOLDEN_BASKET', 'ISUSU'];
    if (!validPlans.includes(planName)) {
      return res.status(400).json({ message: 'Invalid plan name' });
    }

    const clearanceRequired = ['CREST', 'SILVER'].includes(planName);
    const requestedAccounts = numberOfAccounts || 1;

    // Validate referral code if provided
    let referredById = null;
    let usedReferralCodeId = null;
    if (referralCode && referralCode.trim() && referralCode !== 'NEW') {
      const codeStr = referralCode.trim();
      const { rows: refCodes } = await query('SELECT id, user_id, status, unlock_date FROM referral_codes WHERE code = $1', [codeStr]);
      if (refCodes.length > 0) {
        const rc = refCodes[0];
        if (rc.status === 'used') {
          return res.status(400).json({ message: 'This referral code has already been used' });
        }
        if (rc.status === 'locked' || (rc.unlock_date && new Date(rc.unlock_date) > new Date())) {
          return res.status(400).json({ message: 'This referral code is not yet activated/unlocked' });
        }
        referredById = rc.user_id;
        usedReferralCodeId = rc.id;
      } else {
        const { rows: referrerRows } = await query('SELECT id FROM users WHERE referral_code = $1', [codeStr]);
        if (referrerRows.length === 0) {
          return res.status(400).json({ message: 'Invalid referral code' });
        }
        referredById = referrerRows[0].id;
      }
    }

    // Check Bulk Account Monthly Limit (100 accounts per month)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { rows: monthlyPlanRows } = await query(
      `SELECT COALESCE(SUM(number_of_accounts), 0) as total FROM savings_plans WHERE user_id = $1 AND created_at >= $2`,
      [userId, monthStart]
    );
    const monthlyTotal = parseInt(monthlyPlanRows[0].total, 10);

    let refundOnly = false;
    if (monthlyTotal + requestedAccounts > 100) {
      refundOnly = true;
    }

    // 3. Define Plan Configurations for Wallet Balance Validation
    const planConfigs = {
      CREST: { initialSavings: 4000.00, regFee: 3000.00 },
      SILVER: { initialSavings: 1500.00, regFee: 2500.00 },
      GOLDEN_BASKET: { initialSavings: 2000.00, regFee: 3000.00 },
      ISUSU: { initialSavings: 500.00, regFee: 0.00 }
    };

    const config = planConfigs[planName];
    const initialSavingsTotal = config.initialSavings * requestedAccounts;
    const regFeeTotal = config.regFee * requestedAccounts;
    const totalFirstPayment = initialSavingsTotal + regFeeTotal;

    // Set preferred day automatically to the previous day name (e.g., if joined Monday, deduct Sunday)
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = new Date().getDay();
    const autoPreferredDay = daysOfWeek[(currentDayIndex + 6) % 7];

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Fetch user's available balance with row locking
      const { rows: users } = await client.query(
        'SELECT available_balance, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      const user = users[0];
      const availableBalance = parseFloat(user.available_balance);

      if (availableBalance < totalFirstPayment) {
        throw new Error(`Insufficient wallet balance. This subscription requires a total upfront payment of ₦${totalFirstPayment.toLocaleString()} (₦${initialSavingsTotal.toLocaleString()} initial savings + ₦${regFeeTotal.toLocaleString()} registration fee for ${requestedAccounts} account${requestedAccounts > 1 ? 's' : ''}), but your wallet has ₦${availableBalance.toLocaleString()}. Please fund your wallet to proceed.`);
      }

      // Deduct total first payment from balances
      await client.query(
        'UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2',
        [totalFirstPayment, userId]
      );

      // Create the plan
      const plan = await createSavingsPlan(userId, planName, targetAmount, requestedAccounts, clearanceRequired, refundOnly, autoPreferredDay, client);

      // Calculate end_date based on plan duration
      const planDurations = {
        CREST: { weeks: 12 },
        SILVER: { weeks: 50 },
        GOLDEN_BASKET: { weeks: 50 },
        ISUSU: { days: 30 }
      };
      const duration = planDurations[planName];
      const endDate = new Date(plan.start_date || plan.created_at);
      if (duration) {
        if (duration.weeks) endDate.setDate(endDate.getDate() + duration.weeks * 7);
        if (duration.days) endDate.setDate(endDate.getDate() + duration.days);
      }

      const { rows: updatedPlanRows } = await client.query(
        'UPDATE savings_plans SET end_date = $1, maturity_date = $1 WHERE id = $2 RETURNING *',
        [endDate, plan.id]
      );
      Object.assign(plan, updatedPlanRows[0]);
      // Adjust referral dates based on plan type (Legacy columns logic kept for backward compatibility)
      if (planName === 'SILVER') {
        // SILVER plans unlock referrals automatically and expire in 90 days
        await client.query(
          `UPDATE users 
           SET referral_unlock_date = CURRENT_TIMESTAMP, 
               referral_expiry_date = CURRENT_TIMESTAMP + INTERVAL '90 days' 
           WHERE id = $1`,
          [userId]
        );
      }

      // Process referral code if provided
      if (usedReferralCodeId) {
        await client.query(
          "UPDATE users SET referred_by = $1 WHERE id = $2",
          [referredById, userId]
        );
        await client.query(
          "UPDATE referral_codes SET status = 'used', used_by_user_id = $2 WHERE id = $1",
          [usedReferralCodeId, userId]
        );
      } else if (referredById && !usedReferralCodeId) {
        await client.query(
          "UPDATE users SET referred_by = $1 WHERE id = $2",
          [referredById, userId]
        );
      }

      // Generate one referral code per account
      await createReferralCodeForPlan(client, userId, plan.id, planName, requestedAccounts);

      // Set the initial current_amount of the savings plan to initialSavingsTotal
      await client.query(
        'UPDATE savings_plans SET current_amount = $1 WHERE id = $2',
        [initialSavingsTotal, plan.id]
      );

      // Log transactions
      const savingsRef = `SAV-${Date.now()}`;
      await client.query(`
        INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
        VALUES ($1, $2, 'savings', $3, 'completed', $4)
      `, [userId, plan.id, initialSavingsTotal, savingsRef]);

      await createWalletLedgerEntry(client, userId, 'debit', initialSavingsTotal, savingsRef, `Initial savings deposit for Plan: ${planName}`);

      if (regFeeTotal > 0) {
        const regRef = `REG-${Date.now()}`;
        await client.query(`
          INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
          VALUES ($1, $2, 'registration', $3, 'completed', $4)
        `, [userId, plan.id, regFeeTotal, regRef]);

        await createWalletLedgerEntry(client, userId, 'debit', regFeeTotal, regRef, `One-time registration fee for Plan: ${planName}`);
      }

      await client.query('COMMIT');

      // Update response object values
      plan.current_amount = initialSavingsTotal;

      res.status(201).json(plan);
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: err.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in subscribeToPlan:', error);
    res.status(500).json({ message: 'Server error during subscription' });
  }
};

export const getMyPlans = async (req, res) => {
  try {
    const userId = req.user.id;
    const plans = await getUserSavingsPlans(userId);
    res.json(plans);
  } catch (error) {
    console.error('Error in getMyPlans:', error);
    res.status(500).json({ message: 'Server error fetching plans' });
  }
};

export const payClearanceFee = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      const { rows: plans } = await client.query('SELECT * FROM savings_plans WHERE id = $1 AND user_id = $2 FOR UPDATE', [planId, userId]);
      if (plans.length === 0) throw new Error('Plan not found or unauthorized');
      const plan = plans[0];

      if (plan.status !== 'pending_clearance' || !plan.clearance_required) {
        throw new Error('Plan is not pending clearance payment');
      }
      if (plan.clearance_paid) {
        throw new Error('Clearance already paid');
      }

      const { rows: users } = await client.query('SELECT available_balance, wallet_balance, tshirt_paid FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = users[0];
      
      if (!user.tshirt_paid) {
        throw new Error('T-Shirt Payment Required: You must pay your Incentive T-Shirt fee of ₦5,000 in your wallet before paying clearance fees.');
      }

      const clearanceFee = 3000.00;

      if (parseFloat(user.available_balance) >= clearanceFee) {
        // Option 1: Deduct from Wallet
        await client.query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2', [clearanceFee, userId]);
        
        // Log transaction
        const reference = `CLR-${Date.now()}`;
        await client.query(`
          INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
          VALUES ($1, $2, 'clearance', $3, 'completed', $4)
        `, [userId, planId, clearanceFee, reference]);

        // Ledger entry
        await createWalletLedgerEntry(client, userId, 'debit', clearanceFee, reference, `Clearance Fee for Plan: ${plan.plan_name}`);

      } else {
        throw new Error('Insufficient available balance. Please top up your wallet to pay the clearance fee.');
      }

      const payoutDate = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
      
      const updatePlanText = `
        UPDATE savings_plans 
        SET status = 'pending_settlement', clearance_paid = TRUE, clearance_date = CURRENT_TIMESTAMP, payout_date = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 RETURNING *;
      `;
      const { rows: updatedPlans } = await client.query(updatePlanText, [payoutDate, planId]);

      // Note: Payout record has already been created by the Admin during the Eligibility Review phase.
      // We only need to transition the plan to pending_settlement.

      await client.query('COMMIT');
      res.json({ message: 'Clearance fee paid successfully', plan: updatedPlans[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in payClearanceFee:', error);
    res.status(500).json({ message: 'Server error during clearance payment' });
  }
};

export const payTshirtFee = async (req, res) => {
  try {
    const userId = req.user.id;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      const { rows: users } = await client.query('SELECT available_balance, wallet_balance, tshirt_paid FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = users[0];
      
      if (user.tshirt_paid) {
        throw new Error('T-Shirt fee already paid');
      }

      const tshirtFee = 5000.00;
      if (parseFloat(user.available_balance) >= tshirtFee) {
        await client.query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1, tshirt_paid = TRUE, tshirt_payment_date = CURRENT_TIMESTAMP WHERE id = $2', [tshirtFee, userId]);
        
        const reference = `TSHIRT-${Date.now()}`;
        await client.query(`
          INSERT INTO transactions (user_id, type, amount, status, reference)
          VALUES ($1, 'membership', $2, 'completed', $3)
        `, [userId, tshirtFee, reference]);

        // Ledger entry
        await createWalletLedgerEntry(client, userId, 'debit', tshirtFee, reference, 'Incentive T-Shirt Payment');
      } else {
        throw new Error('Insufficient available balance to pay T-Shirt fee (₦5,000). Please fund your wallet.');
      }

      await client.query('COMMIT');
      res.json({ message: 'T-Shirt fee paid successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error paying T-Shirt fee:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMyDefaults = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await query(`
      SELECT
        sp.id AS plan_id,
        sp.plan_name,
        sp.number_of_accounts,
        sp.status AS plan_status,
        COALESCE(SUM(d.penalty_amount), 0) AS total_default_amount,
        COUNT(d.id) AS default_count,
        json_agg(
          json_build_object(
            'id', d.id,
            'missed_date', d.missed_date,
            'penalty_amount', d.penalty_amount,
            'resolved', d.resolved,
            'resolved_at', d.resolved_at,
            'created_at', d.created_at
          )
          ORDER BY d.missed_date DESC
        ) FILTER (WHERE d.id IS NOT NULL) AS defaults
      FROM savings_plans sp
      LEFT JOIN defaults d ON d.plan_id = sp.id AND d.user_id = sp.user_id
      WHERE sp.user_id = $1
      GROUP BY sp.id, sp.plan_name, sp.number_of_accounts, sp.status
      ORDER BY sp.created_at DESC
    `, [userId]);

    const planConfig = {
      CREST: { weekly: 4000, penalty: 4000 },
      SILVER: { weekly: 1500, penalty: 1500 },
      GOLDEN_BASKET: { weekly: 2000, penalty: 2000 },
      ISUSU: { daily: 500, penalty: 500 }
    };

    const result = rows.map(r => ({
      ...r,
      total_default_amount: parseFloat(r.total_default_amount),
      default_count: parseInt(r.default_count),
      weekly_amount: planConfig[r.plan_name]?.weekly || planConfig[r.plan_name]?.daily || 0,
      penalty_per_account: planConfig[r.plan_name]?.penalty || 0,
      defaults: r.defaults || []
    }));

    res.json(result);
  } catch (error) {
    console.error('Error in getMyDefaults:', error);
    res.status(500).json({ message: 'Server error fetching defaults' });
  }
};

export const getPlanDefaultsDetail = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.id;

    const { rows: plans } = await query(
      'SELECT * FROM savings_plans WHERE id = $1 AND user_id = $2',
      [planId, userId]
    );
    if (plans.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    const plan = plans[0];

    const { rows: defaults } = await query(
      'SELECT * FROM defaults WHERE plan_id = $1 AND user_id = $2 ORDER BY missed_date DESC',
      [planId, userId]
    );

    const { rows: transactions } = await query(
      `SELECT t.*, COALESCE(p.plan_name, t.type) AS plan_name
       FROM transactions t
       LEFT JOIN savings_plans p ON t.plan_id = p.id
       WHERE t.plan_id = $1 AND t.user_id = $2
       ORDER BY t.created_at DESC LIMIT 20`,
      [planId, userId]
    );

    const { rows: unreconciled } = await query(
      'SELECT COALESCE(SUM(penalty_amount), 0) as outstanding, COUNT(*) as count FROM defaults WHERE plan_id = $1 AND user_id = $2 AND resolved = FALSE',
      [planId, userId]
    );

    const planConfig = {
      CREST: { weekly: 4000, penalty: 4000, duration: '12 weeks', target: 96000 },
      SILVER: { weekly: 1500, penalty: 1500, duration: '50 weeks', target: 150000 },
      GOLDEN_BASKET: { weekly: 2000, penalty: 2000, duration: '50 weeks', target: 200000 },
      ISUSU: { daily: 500, penalty: 500, duration: '30 days', target: 15000 }
    };
    const config = planConfig[plan.plan_name] || {};

    const isDaily = !!config.daily;
    const perAccountAmount = config.weekly || config.daily || 0;

    let totalExpected = 0;
    if (isDaily) {
      totalExpected = config.daily * (plan.number_of_accounts || 1) * 30;
    } else {
      totalExpected = config.weekly * (plan.number_of_accounts || 1) * 12;
      if (plan.plan_name === 'SILVER' || plan.plan_name === 'GOLDEN_BASKET') {
        totalExpected = config.weekly * (plan.number_of_accounts || 1) * 50;
      }
    }

    const lastTransaction = transactions.length > 0 ? transactions[0] : null;

    res.json({
      plan: {
        id: plan.id,
        plan_name: plan.plan_name,
        number_of_accounts: plan.number_of_accounts || 1,
        status: plan.status,
        start_date: plan.start_date,
        end_date: plan.end_date,
        maturity_date: plan.maturity_date,
        current_amount: parseFloat(plan.current_amount || 0),
        target_amount: parseFloat(plan.target_amount || totalExpected),
        preferred_day: plan.preferred_day,
        clearance_required: plan.clearance_required,
        clearance_paid: plan.clearance_paid,
        refund_only: plan.refund_only,
        created_at: plan.created_at
      },
      config: {
        per_account_amount: perAccountAmount,
        penalty_per_account: config.penalty || 0,
        is_daily: isDaily,
        duration: config.duration || ''
      },
      defaults,
      transactions,
      summary: {
        outstanding_defaults: parseFloat(unreconciled[0].outstanding),
        default_count: parseInt(unreconciled[0].count),
        total_saved: parseFloat(plan.current_amount || 0),
        total_transactions: transactions.length,
        last_payment: lastTransaction ? {
          amount: parseFloat(lastTransaction.amount),
          type: lastTransaction.type,
          status: lastTransaction.status,
          date: lastTransaction.created_at
        } : null
      }
    });
  } catch (error) {
    console.error('Error in getPlanDefaultsDetail:', error);
    res.status(500).json({ message: 'Server error fetching plan defaults detail' });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.id;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { rows: plans } = await client.query('SELECT * FROM savings_plans WHERE id = $1 AND user_id = $2 FOR UPDATE', [planId, userId]);
      
      if (plans.length === 0) {
        throw new Error('Plan not found or unauthorized');
      }

      const plan = plans[0];

      if (plan.status !== 'active') {
        throw new Error('Only active plans can be deleted/cancelled.');
      }

      const refundAmount = parseFloat(plan.current_amount || 0);

      if (refundAmount > 0) {
        // Refund to wallet
        await client.query(
          'UPDATE users SET available_balance = available_balance + $1, wallet_balance = wallet_balance + $1 WHERE id = $2',
          [refundAmount, userId]
        );

        // Log transaction
        const reference = `REF-${Date.now()}`;
        await client.query(`
          INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
          VALUES ($1, $2, 'refund', $3, 'completed', $4)
        `, [userId, planId, refundAmount, reference]);

        // Ledger entry
        await createWalletLedgerEntry(client, userId, 'credit', refundAmount, reference, `Refund for cancelled plan: ${plan.plan_name}`);
      }

      // Update plan status
      const updatePlanText = `
        UPDATE savings_plans 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *;
      `;
      const { rows: updatedPlans } = await client.query(updatePlanText, [planId]);

      await client.query('COMMIT');
      res.json({ message: 'Subscription deleted successfully.', plan: updatedPlans[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ message: 'Server error during cancellation' });
  }
};

