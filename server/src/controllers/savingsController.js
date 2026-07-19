import { createSavingsPlan, getUserSavingsPlans } from '../models/savingsModel.js';
import { getClient, query } from '../config/db.js';
import { createWalletLedgerEntry } from '../models/transactionModel.js';
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

    // Set preferred day to the day the user is registering on
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = new Date().getDay();
    const autoPreferredDay = daysOfWeek[currentDayIndex];

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // ── REFERRAL CODE: validate + consume atomically inside transaction ──
      // If a code is provided, it MUST be valid and available. If not, throw
      // an error → ROLLBACK → no account created. "NEW" or empty = no referral.
      const hasReferralCode = referralCode && referralCode.trim() && referralCode.trim() !== 'NEW';
      let referredById = null;

      if (hasReferralCode) {
        const codeStr = referralCode.trim();

        // Lock the row immediately to prevent concurrent consumption
        const { rows: refCodes } = await client.query(
          'SELECT id, user_id, status, unlock_date, expires_at FROM referral_codes WHERE code = $1 FOR UPDATE',
          [codeStr]
        );

        if (refCodes.length === 0) {
          throw new Error('Invalid referral code. No account will be created. Please check the code and try again, or enter NEW to subscribe without a referral.');
        }

        const rc = refCodes[0];

        if (rc.status === 'used') {
          throw new Error('This referral code has already been used by another subscriber. No account will be created. Please use a different code or enter NEW to subscribe without a referral.');
        }

        if (rc.status === 'expired') {
          throw new Error('This referral code has expired. No account will be created. Please use a valid code or enter NEW to subscribe without a referral.');
        }

        // Auto-unlock if CREST code's unlock_date has passed
        if (rc.status === 'locked' && rc.unlock_date && new Date(rc.unlock_date) <= new Date()) {
          await client.query('UPDATE referral_codes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['available', rc.id]);
          rc.status = 'available';
        }

        if (rc.status === 'locked') {
          throw new Error('This referral code is not yet activated/unlocked. No account will be created. Please wait for it to unlock or enter NEW to subscribe without a referral.');
        }

        // Check if code has expired by expires_at
        if (rc.expires_at && new Date(rc.expires_at) < new Date()) {
          await client.query("UPDATE referral_codes SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [rc.id]);
          throw new Error('This referral code has expired. No account will be created. Please use a valid code or enter NEW to subscribe without a referral.');
        }

        referredById = rc.user_id;

        // If user already has a referrer, don't overwrite — just consume the code for credit
        const { rows: existingUser } = await client.query('SELECT referred_by FROM users WHERE id = $1', [userId]);
        if (!existingUser[0].referred_by) {
          await client.query('UPDATE users SET referred_by = $1 WHERE id = $2', [referredById, userId]);
        }

        // Mark code as used (always, whether self-referral or not)
        await client.query(
          "UPDATE referral_codes SET status = 'used', used_by_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [userId, rc.id]
        );
      }

      // ── WALLET: validate + deduct ──
      const { rows: users } = await client.query(
        'SELECT available_balance, wallet_balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      const user = users[0];
      const availableBalance = parseFloat(user.available_balance);

      if (availableBalance < totalFirstPayment) {
        throw new Error(`Insufficient wallet balance. This subscription requires a total upfront payment of ₦${totalFirstPayment.toLocaleString()} (₦${initialSavingsTotal.toLocaleString()} initial savings + ₦${regFeeTotal.toLocaleString()} registration fee for ${requestedAccounts} account${requestedAccounts > 1 ? 's' : ''}), but your wallet has ₦${availableBalance.toLocaleString()}. Please fund your wallet to proceed.`);
      }

      await client.query(
        'UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2',
        [totalFirstPayment, userId]
      );

      // ── CREATE PLAN ──
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

      if (planName === 'SILVER') {
        await client.query(
          `UPDATE users 
           SET referral_unlock_date = CURRENT_TIMESTAMP, 
               referral_expiry_date = CURRENT_TIMESTAMP + INTERVAL '90 days' 
           WHERE id = $1`,
          [userId]
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
    const { planId, accountIndex } = req.body;
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
        throw new Error('Clearance already paid fully');
      }

      const { rows: users } = await client.query('SELECT available_balance, wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = users[0];

      const accounts = plan.number_of_accounts || 1;
      const accountsCleared = parseInt(plan.accounts_cleared || 0, 10);
      const remainingAccounts = accounts - accountsCleared;

      if (remainingAccounts <= 0) throw new Error('All accounts already cleared');

      // Per-account mode: charge ₦3,000 for one account; bulk: charge for remaining
      const isPerAccount = typeof accountIndex === 'number' || accountIndex !== undefined;
      if (isPerAccount && (accountIndex < 0 || accountIndex >= accounts)) {
        throw new Error('Invalid account index');
      }
      if (isPerAccount && accountIndex < accountsCleared) {
        throw new Error('Account already cleared');
      }
      const clearanceFee = isPerAccount ? 3000.00 : (3000.00 * remainingAccounts);

      if (parseFloat(user.available_balance) < clearanceFee) {
        throw new Error(`Insufficient available balance. This requires ₦${clearanceFee.toLocaleString()}. Please top up your wallet.`);
      }

      await client.query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2', [clearanceFee, userId]);

      const reference = `CLR-${Date.now()}-${plan.id}`;
      const label = isPerAccount ? `Clearance Fee for ${plan.plan_name} (Account ${(accountIndex || 0) + 1})` : `Clearance Fee for ${plan.plan_name} (${accounts} account(s))`;
      await client.query(`
        INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
        VALUES ($1, $2, 'clearance', $3, 'completed', $4)
      `, [userId, planId, clearanceFee, reference]);
      await createWalletLedgerEntry(client, userId, 'debit', clearanceFee, reference, label);

      // Update accounts_cleared
      const newCleared = isPerAccount ? accountsCleared + 1 : accounts;
      if (isPerAccount) {
        await client.query(
          'UPDATE savings_plans SET accounts_cleared = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newCleared, planId]
        );
      }

      // Only transition to pending_settlement when all accounts cleared
      let payoutDate = null;
      if (newCleared >= accounts) {
        const planStart = new Date(plan.start_date);
        switch (plan.plan_name) {
          case 'CREST':
            payoutDate = new Date(planStart.getTime() + (98 * 24 * 60 * 60 * 1000));
            break;
          case 'SILVER':
          case 'GOLDEN_BASKET':
            payoutDate = new Date(planStart.getTime() + (364 * 24 * 60 * 60 * 1000));
            break;
          default:
            payoutDate = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000));
        }

        const { rows: updatedPlans } = await client.query(`
          UPDATE savings_plans 
          SET status = 'pending_settlement', clearance_paid = TRUE, clearance_date = CURRENT_TIMESTAMP, accounts_cleared = $1, payout_date = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3 RETURNING *;
        `, [newCleared, payoutDate, planId]);

        await client.query('COMMIT');
        return res.json({ message: 'All clearance fees paid! Plan moved to pending settlement.', plan: updatedPlans[0] });
      }

      await client.query('COMMIT');
      const remaining = accounts - newCleared;
      res.json({ message: `Account ${(accountIndex || 0) + 1} cleared. ${remaining} account(s) remaining for this plan.`, accounts_cleared: newCleared, accounts_remaining: remaining });
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

export const bulkClearance = async (req, res) => {
  try {
    const userId = req.user.id;
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Verify t-shirt paid
      const { rows: users } = await client.query('SELECT available_balance, wallet_balance, tshirt_paid FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const user = users[0];
      if (!user.tshirt_paid) {
        throw new Error('T-Shirt Payment Required: You must pay your Incentive T-Shirt fee of ₦5,000 before bulk clearance.');
      }

      // Fetch all pending_clearance plans for this user (where not fully cleared)
      const { rows: plans } = await client.query(
        `SELECT * FROM savings_plans WHERE user_id = $1 AND status = 'pending_clearance' AND accounts_cleared < number_of_accounts FOR UPDATE`,
        [userId]
      );

      if (plans.length === 0) {
        throw new Error('No plans pending clearance payment');
      }

      // Calculate total fee (3000 per remaining account per plan)
      let totalFee = 0;
      for (const plan of plans) {
        const accounts = plan.number_of_accounts || 1;
        const alreadyCleared = parseInt(plan.accounts_cleared || 0, 10);
        const remaining = accounts - alreadyCleared;
        totalFee += 3000 * remaining;
      }

      if (parseFloat(user.available_balance) < totalFee) {
        throw new Error(`Insufficient balance. Bulk clearance requires ₦${totalFee.toLocaleString()} for remaining accounts.`);
      }

      // Deduct total from wallet
      await client.query('UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2', [totalFee, userId]);

      // Process each plan
      const updatedPlans = [];
      for (const plan of plans) {
        const accounts = plan.number_of_accounts || 1;
        const alreadyCleared = parseInt(plan.accounts_cleared || 0, 10);
        const remaining = accounts - alreadyCleared;
        const fee = 3000 * remaining;
        const newCleared = accounts;

        const reference = `CLR-${Date.now()}-${plan.id}`;
        await client.query(`
          INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
          VALUES ($1, $2, 'clearance', $3, 'completed', $4)
        `, [userId, plan.id, fee, reference]);

        await createWalletLedgerEntry(client, userId, 'debit', fee, reference, `Bulk Clearance Fee for Plan: ${plan.plan_name} (${remaining} remaining account(s))`);

        let payoutDate;
        const planStart = new Date(plan.start_date);
        switch (plan.plan_name) {
          case 'CREST':
            payoutDate = new Date(planStart.getTime() + (98 * 24 * 60 * 60 * 1000));
            break;
          case 'SILVER':
          case 'GOLDEN_BASKET':
            payoutDate = new Date(planStart.getTime() + (364 * 24 * 60 * 60 * 1000));
            break;
          default:
            payoutDate = new Date(Date.now() + (14 * 24 * 60 * 60 * 1000));
        }

        const { rows: updated } = await client.query(`
          UPDATE savings_plans
          SET status = 'pending_settlement', clearance_paid = TRUE, clearance_date = CURRENT_TIMESTAMP, accounts_cleared = $1, payout_date = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3 RETURNING *
        `, [newCleared, payoutDate, plan.id]);

        updatedPlans.push(updated[0]);
      }

      await client.query('COMMIT');
      res.json({ message: `Bulk clearance completed for ${plans.length} plan(s). Total fee: ₦${totalFee.toLocaleString()}`, plans: updatedPlans });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in bulkClearance:', error);
    res.status(500).json({ message: 'Server error during bulk clearance' });
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
        ) AS defaults
      FROM savings_plans sp
      INNER JOIN defaults d ON d.plan_id = sp.id AND d.user_id = sp.user_id AND d.resolved = FALSE
      WHERE sp.user_id = $1
      GROUP BY sp.id, sp.plan_name, sp.number_of_accounts, sp.status
      HAVING COUNT(d.id) > 0
      ORDER BY sp.created_at DESC
    `, [userId]);

    const planConfig = {
      CREST: { weekly: 4000, penalty: 8000 },
      SILVER: { weekly: 1500, penalty: 3000 },
      GOLDEN_BASKET: { weekly: 2000, penalty: 4000 },
      ISUSU: { daily: 500, penalty: 1000 }
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
      CREST: { weekly: 4000, penalty: 8000, duration: '12 weeks', target: 96000 },
      SILVER: { weekly: 1500, penalty: 3000, duration: '50 weeks', target: 150000 },
      GOLDEN_BASKET: { weekly: 2000, penalty: 4000, duration: '50 weeks', target: 200000 },
      ISUSU: { daily: 500, penalty: 1000, duration: '30 days', target: 15000 }
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

      const refundAmount = Math.floor(parseFloat(plan.current_amount || 0));

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

const PLANS_CONFIG = {
  'CREST': 4000,
  'SILVER': 1500,
  'GOLDEN_BASKET': 2000,
  'ISUSU': 500
};

export const clearDefaults = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userId = req.user.id;

    const { rows: users } = await client.query('SELECT id, available_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (users.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'User not found' });
    }

    const balance = Math.floor(parseFloat(users[0].available_balance));

    const { rows: defaults } = await client.query(`
      SELECT d.id, d.plan_id, d.penalty_amount, d.missed_date, sp.plan_name, sp.number_of_accounts, sp.current_amount
      FROM defaults d
      JOIN savings_plans sp ON d.plan_id = sp.id
      WHERE d.user_id = $1 AND d.resolved = FALSE
      ORDER BY d.missed_date ASC
      FOR UPDATE
    `, [userId]);

    if (defaults.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No outstanding defaults to clear' });
    }

    let remainingBalance = balance;
    let totalDeducted = 0;
    let totalToSavings = 0;
    let resolvedDefaults = 0;
    const results = [];

    for (const d of defaults) {
      if (remainingBalance <= 0) break;

      const perAccountAmount = PLANS_CONFIG[d.plan_name];
      if (!perAccountAmount) continue;

      const numAccounts = parseInt(d.number_of_accounts) || 1;
      let penaltyAmount = Math.floor(parseFloat(d.penalty_amount));
      const perAccountCost = perAccountAmount * 2;
      const remainingAccounts = Math.floor(penaltyAmount / perAccountCost);
      const affordable = Math.floor(remainingBalance / perAccountCost);
      const accountsToClear = Math.min(affordable, remainingAccounts);

      if (accountsToClear <= 0) continue;

      const cost = accountsToClear * perAccountCost;
      const savingsPortion = accountsToClear * perAccountAmount;

      remainingBalance -= cost;
      totalDeducted += cost;
      totalToSavings += savingsPortion;

      await client.query(
        'UPDATE savings_plans SET current_amount = COALESCE(current_amount, 0) + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [savingsPortion, d.plan_id]
      );

      const newPenalty = penaltyAmount - cost;
      if (newPenalty <= 0) {
        await client.query(
          'UPDATE defaults SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1',
          [d.id]
        );
        resolvedDefaults++;
      } else {
        await client.query(
          'UPDATE defaults SET penalty_amount = $1 WHERE id = $2',
          [newPenalty, d.id]
        );
      }

      results.push({
        defaultId: d.id,
        plan_name: d.plan_name,
        accountsCleared: accountsToClear,
        amountPaid: cost,
        fullyResolved: newPenalty <= 0
      });
    }

    if (totalDeducted <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Insufficient wallet balance to clear any defaults',
        neededPerAccount: `₦${(PLANS_CONFIG[defaults[0]?.plan_name] || 1500) * 2}`
      });
    }

    await client.query(
      'UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2',
      [totalDeducted, userId]
    );

    const reference = `CLRDFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await client.query(
      `INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
       VALUES ($1, NULL, 'default_clearance', $2, 'completed', $3)`,
      [userId, totalDeducted, reference]
    );

    await createWalletLedgerEntry(client, userId, 'debit', totalDeducted, reference, `Wallet clearance of defaults: ₦${totalDeducted.toLocaleString()} (₦${totalToSavings.toLocaleString()} to savings, ₦${(totalDeducted - totalToSavings).toLocaleString()} penalty settled)`);

    await client.query('COMMIT');

    const { rows: updatedUser } = await client.query(
      'SELECT available_balance FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: `Defaults cleared successfully. ₦${totalDeducted.toLocaleString()} deducted from wallet. ₦${totalToSavings.toLocaleString()} credited to savings plans.`,
      totalDeducted,
      totalToSavings,
      resolvedDefaults,
      newBalance: Math.floor(parseFloat(updatedUser[0].available_balance)),
      results
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in clearDefaults:', error);
    res.status(500).json({ message: 'Server error clearing defaults' });
  } finally {
    client.release();
  }
};

export const clearDefaultById = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const userId = req.user.id;
    const { defaultId } = req.params;

    const { rows: defaults } = await client.query(`
      SELECT d.id, d.penalty_amount, d.plan_id, d.missed_date, sp.plan_name, sp.number_of_accounts
      FROM defaults d
      JOIN savings_plans sp ON d.plan_id = sp.id
      WHERE d.id = $1 AND d.user_id = $2 AND d.resolved = FALSE
      FOR UPDATE
    `, [defaultId, userId]);

    if (defaults.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Default not found or already resolved' });
    }

    const d = defaults[0];
    const perAccountAmount = PLANS_CONFIG[d.plan_name];
    if (!perAccountAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Unknown plan' });
    }

    const penaltyAmount = Math.floor(parseFloat(d.penalty_amount));

    const { rows: users } = await client.query('SELECT id, available_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const balance = Math.floor(parseFloat(users[0].available_balance));

    if (balance < penaltyAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Insufficient balance. You need ₦${penaltyAmount.toLocaleString()} to clear this default. You have ₦${balance.toLocaleString()}.`,
        needed: penaltyAmount,
        balance
      });
    }

    const savingsPortion = Math.floor(penaltyAmount / 2);

    await client.query(
      'UPDATE users SET available_balance = available_balance - $1, wallet_balance = wallet_balance - $1 WHERE id = $2',
      [penaltyAmount, userId]
    );

    await client.query(
      'UPDATE savings_plans SET current_amount = COALESCE(current_amount, 0) + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [savingsPortion, d.plan_id]
    );

    await client.query(
      'UPDATE defaults SET resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1',
      [d.id]
    );

    const reference = `CLRDFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await client.query(
      `INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
       VALUES ($1, $2, 'default_clearance', $3, 'completed', $4)`,
      [userId, d.plan_id, penaltyAmount, reference]
    );

    await createWalletLedgerEntry(client, userId, 'debit', penaltyAmount, reference,
      `Cleared default for ${d.plan_name}: ₦${savingsPortion.toLocaleString()} to savings, ₦${savingsPortion.toLocaleString()} penalty settled`);

    await client.query('COMMIT');

    const { rows: updatedUser } = await client.query(
      'SELECT available_balance FROM users WHERE id = $1', [userId]
    );

    res.json({
      success: true,
      message: `Default cleared. ₦${penaltyAmount.toLocaleString()} deducted from wallet. ₦${savingsPortion.toLocaleString()} credited to ${d.plan_name} savings.`,
      defaultId: d.id,
      amountDeducted: penaltyAmount,
      savingsCredited: savingsPortion,
      planName: d.plan_name,
      newBalance: Math.floor(parseFloat(updatedUser[0].available_balance))
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in clearDefaultById:', error);
    res.status(500).json({ message: 'Server error clearing default' });
  } finally {
    client.release();
  }
};

