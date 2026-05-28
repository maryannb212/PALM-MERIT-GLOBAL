import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // First, check all transaction types in the system
  const { rows: types } = await pool.query(`
    SELECT type, status, COUNT(*) as count, SUM(amount) as total
    FROM transactions
    GROUP BY type, status
    ORDER BY type, status
  `);
  console.log('ALL TRANSACTION TYPES AND STATUSES:\n');
  types.forEach(r => {
    console.log(`  ${r.type.padEnd(25)} | ${r.status.padEnd(12)} | Count: ${r.count.toString().padEnd(5)} | Total: ₦${parseFloat(r.total)}`);
  });

  // Now check wallet balance vs ALL completed transaction types
  console.log('\n\nBALANCE AUDIT (accounting for ALL transaction types):\n');
  const { rows } = await pool.query(`
    SELECT 
      u.id, u.first_name, u.last_name,
      COALESCE(u.available_balance, 0) as current_balance,
      COALESCE(u.wallet_balance, 0) as wallet_balance
    FROM users u
    WHERE COALESCE(u.available_balance, 0) != 0 
       OR COALESCE(u.wallet_balance, 0) != 0
       OR u.id IN (SELECT DISTINCT user_id FROM transactions WHERE status = 'completed')
    ORDER BY u.first_name
  `);

  for (const u of rows) {
    const { rows: txRows } = await pool.query(`
      SELECT type, SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 AND status = 'completed'
      GROUP BY type
    `, [u.id]);
    
    const txMap = {};
    txRows.forEach(r => txMap[r.type] = parseFloat(r.total));
    
    const credited = (txMap['wallet_topup'] || 0) + (txMap['deposit'] || 0);
    const debited = Object.entries(txMap)
      .filter(([type]) => !['wallet_topup', 'deposit'].includes(type))
      .reduce((sum, [, val]) => sum + val, 0);
    
    const expected = credited - debited;
    const actual = parseFloat(u.current_balance);
    const diff = actual - expected;
    
    if (Math.abs(diff) >= 1) {
      console.log(`  ❌ ${u.first_name} ${u.last_name}`);
      console.log(`     Actual: ₦${actual} | Credited: ₦${credited} | Debited: ₦${debited} | Expected: ₦${expected} | Diff: ₦${diff}`);
      console.log(`     Breakdown:`, JSON.stringify(txMap));
    }
  }
  
  process.exit(0);
}
run();
