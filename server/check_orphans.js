import { query } from './src/config/db.js';

async function checkOrphans() {
  try {
    const { rows: orphanSavings } = await query(`
      SELECT id, user_id, current_amount 
      FROM savings_plans 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);
    
    const { rows: orphanTxs } = await query(`
      SELECT id, user_id, amount 
      FROM transactions 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);

    console.log("Orphaned Savings Plans:", orphanSavings.length);
    console.table(orphanSavings);

    console.log("Orphaned Transactions:", orphanTxs.length);
    console.table(orphanTxs);
    
    // Also let's check if the user they think they deleted is actually still in the DB
    // Or if the fund needs recalculating? No, SUM() recalculates dynamically.
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

checkOrphans();
