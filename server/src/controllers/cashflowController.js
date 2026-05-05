import { query } from '../config/db.js';

/**
 * Get cash flow summary
 * GET /api/admin/cashflow
 */
export const getCashflowSummary = async (req, res) => {
  try {
    // Total Inflow from transactions (deposits, memberships, clearance, topups)
    const inflowSql = `
      SELECT SUM(amount) as total_inflow
      FROM transactions
      WHERE status = 'completed' AND type IN ('deposit', 'membership', 'clearance', 'wallet_topup', 'contribution');
    `;
    const inflowResult = await query(inflowSql);
    const totalInflow = parseFloat(inflowResult.rows[0].total_inflow) || 0;

    // Total Outflow from completed withdrawals
    const withdrawalSql = `
      SELECT SUM(amount) as total_withdrawals
      FROM transactions
      WHERE status = 'completed' AND type = 'withdrawal';
    `;
    const withdrawalResult = await query(withdrawalSql);
    const totalWithdrawals = parseFloat(withdrawalResult.rows[0].total_withdrawals) || 0;

    // Total Outflow from cash payouts
    const payoutsSql = `
      SELECT SUM(amount) as total_payouts
      FROM payouts
      WHERE status = 'settled' AND payout_type = 'cash';
    `;
    const payoutsResult = await query(payoutsSql);
    const totalPayouts = parseFloat(payoutsResult.rows[0].total_payouts) || 0;

    const totalOutflow = totalWithdrawals + totalPayouts;
    const netFlow = totalInflow - totalOutflow;

    // Recent flows (last 30 days) for trends
    const recentInflowSql = `
      SELECT DATE(created_at) as date, SUM(amount) as daily_inflow
      FROM transactions
      WHERE status = 'completed' AND type IN ('deposit', 'membership', 'clearance', 'wallet_topup', 'contribution')
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC;
    `;
    const recentInflowResult = await query(recentInflowSql);

    const recentWithdrawalSql = `
      SELECT DATE(created_at) as date, SUM(amount) as daily_outflow
      FROM transactions
      WHERE status = 'completed' AND type = 'withdrawal'
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC;
    `;
    const recentWithdrawalResult = await query(recentWithdrawalSql);

    res.json({
      summary: {
        totalInflow,
        totalOutflow,
        netFlow,
        breakdown: {
          withdrawals: totalWithdrawals,
          payouts: totalPayouts
        }
      },
      trends: {
        inflow: recentInflowResult.rows,
        outflow: recentWithdrawalResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching cash flow summary:', error);
    res.status(500).json({ message: 'Server error fetching cash flow summary' });
  }
};
