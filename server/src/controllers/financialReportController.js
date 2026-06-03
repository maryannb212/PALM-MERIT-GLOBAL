import { query } from '../config/db.js';

/**
 * Get comprehensive financial report
 * GET /api/admin/financial-report
 */
export const getFinancialReport = async (req, res) => {
  try {
    // Total transaction count and sum per type
    const txAggSql = `
      SELECT type, COUNT(*) as count, COALESCE(SUM(amount),0) as total_amount
      FROM transactions
      WHERE status = 'completed'
      GROUP BY type;
    `;
    const { rows: txAgg } = await query(txAggSql);

    // Total payouts settled
    const payoutsSql = `
      SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total_amount
      FROM payouts
      WHERE status = 'settled';
    `;
    const { rows: payoutAgg } = await query(payoutsSql);
    const payouts = payoutAgg[0];

    // Total users
    const usersSql = `SELECT COUNT(*) as total_users FROM users;`;
    const { rows: usersAgg } = await query(usersSql);
    const totalUsers = parseInt(usersAgg[0].total_users, 10);

    // Assemble response
    res.json({
      transactionSummary: txAgg,
      payoutSummary: {
        count: parseInt(payouts.count, 10),
        totalAmount: parseFloat(payouts.total_amount)
      },
      totalUsers,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching financial report:', error);
    res.status(500).json({ message: 'Server error fetching financial report' });
  }
};
