import { createSavingsPlan, getUserSavingsPlans } from '../models/savingsModel.js';
import { getClient, query } from '../config/db.js';
import { createWalletLedgerEntry } from '../models/transactionModel.js';

export const subscribeToPlan = async (req, res) => {
  try {
    const { planName, targetAmount, numberOfAccounts, preferredDay } = req.body;
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

    // 1. Check Crest-Silver Linking Rule
    if (planName === 'CREST') {
      const { rows: crestRows } = await query(
        `SELECT COALESCE(SUM(number_of_accounts), 0) as total FROM savings_plans WHERE user_id = $1 AND plan_name = 'CREST'`,
        [userId]
      );
      const totalCrest = parseInt(crestRows[0].total, 10);

      const { rows: silverRows } = await query(
        `SELECT COALESCE(SUM(number_of_accounts), 0) as total FROM savings_plans WHERE user_id = $1 AND plan_name = 'SILVER'`,
        [userId]
      );
      const totalSilver = parseInt(silverRows[0].total, 10);

      // For every 20 CREST, 1 SILVER is required
      const requiredSilver = Math.floor(totalCrest / 20);
      if (totalSilver < requiredSilver) {
        return res.status(403).json({ 
          message: `Business Rule Exception: You have ${totalCrest} CREST accounts and ${totalSilver} SILVER accounts. You must open a SILVER account before creating more CREST accounts (Requirement: 1 Silver per 20 Crest).` 
        });
      }
    }

    // 2. Check Bulk Account Monthly Limit (100 accounts per month)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { rows: monthlyPlanRows } = await query(
      `SELECT COALESCE(SUM(number_of_accounts), 0) as total FROM savings_plans WHERE user_id = $1 AND created_at >= $2`,
      [userId, monthStart]
    );
    const monthlyTotal = parseInt(monthlyPlanRows[0].total, 10);

    let refundOnly = false;
    if (monthlyTotal + requestedAccounts > 100) {
      refundOnly = true;
      // Alternatively, we could partially allow them, but flagging the whole plan is simpler
    }

    const plan = await createSavingsPlan(userId, planName, targetAmount, requestedAccounts, clearanceRequired, refundOnly, preferredDay);

    res.status(201).json(plan);
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

      // Create pending payout record
      const expectedAmount = plan.plan_name === 'CREST' ? 96000 : (plan.plan_name === 'SILVER' ? 150000 : plan.target_amount);
      await client.query(`
        INSERT INTO payouts (user_id, plan_id, amount, payout_type, status)
        VALUES ($1, $2, $3, 'cash', 'pending')
      `, [userId, planId, expectedAmount]);

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
