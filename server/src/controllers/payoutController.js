import { getClient } from '../config/db.js';

export const getPendingPayouts = async (req, res) => {
  try {
    const client = await getClient();
    try {
      // Admin dashboard needs Matured, Pending Clearance, and Pending Settlement plans
      const { rows } = await client.query(`
        SELECT p.id as payout_id, p.amount, p.payout_type, p.status as payout_status,
               s.id as plan_id, s.plan_name, s.status as plan_status, s.clearance_paid, s.maturity_date, s.payout_date,
               u.id as user_id, u.first_name, u.last_name, u.email, u.tshirt_paid
        FROM savings_plans s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN payouts p ON s.id = p.plan_id
        WHERE s.status IN ('matured', 'pending_clearance', 'pending_settlement', 'settled')
        ORDER BY s.payout_date DESC NULLS LAST
      `);
      res.json(rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCEOSchedule = async (req, res) => {
  try {
    const client = await getClient();
    try {
      const { rows } = await client.query(`
        SELECT
          p.id as payout_id, p.amount, p.payout_type, p.status as payout_status, p.created_at as payout_created,
          s.id as plan_id, s.plan_name, s.status as plan_status, s.clearance_paid, s.maturity_date,
          s.payout_date as deadline, s.start_date, s.current_amount, s.target_amount, s.number_of_accounts,
          u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.tshirt_paid
        FROM savings_plans s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN payouts p ON s.id = p.plan_id
        WHERE s.status IN ('pending_clearance', 'pending_settlement')
        ORDER BY s.payout_date ASC NULLS LAST, s.maturity_date ASC
      `);

      const schedule = rows.map(r => {
        const daysUntilDeadline = r.deadline
          ? Math.ceil((new Date(r.deadline) - new Date()) / (1000 * 60 * 60 * 24))
          : null;
        return {
          ...r,
          days_until_deadline: daysUntilDeadline,
          is_overdue: daysUntilDeadline !== null && daysUntilDeadline < 0,
          amount: r.amount ? parseFloat(r.amount) : null,
          current_amount: parseFloat(r.current_amount || 0),
          target_amount: parseFloat(r.target_amount || 0),
          number_of_accounts: parseInt(r.number_of_accounts || 1)
        };
      });

      res.json({
        generated_at: new Date().toISOString(),
        total_pending: schedule.filter(r => r.plan_status === 'pending_settlement').length,
        total_clearance: schedule.filter(r => r.plan_status === 'pending_clearance').length,
        schedule
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching CEO schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const approvePayout = async (req, res) => {
  try {
    const { payoutId, notes } = req.body;
    const adminId = req.user.id;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { rows: payouts } = await client.query('SELECT * FROM payouts WHERE id = $1 FOR UPDATE', [payoutId]);
      if (payouts.length === 0) throw new Error('Payout not found');
      const payout = payouts[0];

      if (payout.status !== 'pending') throw new Error('Payout is not pending');

      // Verify T-Shirt Payment
      const { rows: users } = await client.query('SELECT tshirt_paid FROM users WHERE id = $1', [payout.user_id]);
      if (!users[0].tshirt_paid) {
        throw new Error('T-Shirt payment is required before settlement can be approved.');
      }

      // Update payout
      await client.query(`
        UPDATE payouts 
        SET status = 'settled', approved_by = $1, approved_at = CURRENT_TIMESTAMP, notes = $2
        WHERE id = $3
      `, [adminId, notes || '', payoutId]);

      // Update savings plan
      await client.query(`
        UPDATE savings_plans
        SET status = 'settled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [payout.plan_id]);

      // If it's cash, we log the transaction (though payout is manual out-of-band usually, we log it for tracking)
      if (payout.payout_type === 'cash') {
        await client.query(`
          INSERT INTO transactions (user_id, plan_id, type, amount, status, reference)
          VALUES ($1, $2, 'withdrawal', $3, 'completed', $4)
        `, [payout.user_id, payout.plan_id, payout.amount, `SET-${Date.now()}`]);
      }

      await client.query('COMMIT');
      res.json({ message: 'Payout approved successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: error.message });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error approving payout:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
