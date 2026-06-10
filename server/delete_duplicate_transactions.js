import { getClient } from './src/config/db.js';

const deleteDuplicateTransactions = async () => {
  console.log('--- Starting Deletion of Duplicate Transactions ---');
  const client = await getClient();
  try {
    // Find all 'savings' transactions that are catch-ups
    const sql = `
      SELECT id, reference, amount, plan_id, user_id, created_at
      FROM transactions
      WHERE reference LIKE 'CATCHUP-%' AND status = 'completed'
      ORDER BY plan_id, amount, created_at ASC
    `;
    const { rows } = await client.query(sql);

    // Group by plan_id + amount + date (within a 10-second window)
    const duplicatesToDelete = [];
    
    const planGroups = {};
    for (const row of rows) {
      if (!planGroups[row.plan_id]) planGroups[row.plan_id] = [];
      planGroups[row.plan_id].push(row);
    }
    
    for (const planId in planGroups) {
      const txs = planGroups[planId];
      // Keep track of the first seen transaction in a timeframe
      const seen = [];
      
      for (const tx of txs) {
        const txTime = new Date(tx.created_at).getTime();
        
        // Is there another tx in 'seen' with the same amount within 10 seconds?
        const isDuplicate = seen.find(s => 
          s.amount === tx.amount && 
          Math.abs(new Date(s.created_at).getTime() - txTime) < 10000
        );
        
        if (isDuplicate) {
          duplicatesToDelete.push(tx.id);
        } else {
          seen.push(tx);
        }
      }
    }
    
    console.log(`Found ${duplicatesToDelete.length} duplicate CATCHUP transactions to delete.`);
    
    if (duplicatesToDelete.length > 0) {
      const deleteSql = `DELETE FROM transactions WHERE id = ANY($1::uuid[])`;
      await client.query(deleteSql, [duplicatesToDelete]);
      console.log(`Successfully deleted ${duplicatesToDelete.length} duplicate transactions.`);
    }

  } catch (err) {
    console.error('Error deleting duplicates:', err);
  } finally {
    client.release();
    process.exit(0);
  }
};

deleteDuplicateTransactions();
