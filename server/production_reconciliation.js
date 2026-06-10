import { getClient } from './src/config/db.js';

const runProductionReconciliation = async () => {
  console.log('--- STARTING PRODUCTION RECONCILIATION ---');
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // 1. Fetch all CATCHUP transactions that were successful
    const { rows: catchupTxs } = await client.query(`
      SELECT id, reference, amount, plan_id, user_id, created_at
      FROM transactions
      WHERE reference LIKE 'CATCHUP-%' AND status = 'completed'
      ORDER BY plan_id, created_at ASC
    `);

    // 2. Group transactions by (plan_id + local_date) to find duplicates for the SAME plan on the SAME day
    const planGroups = {};
    for (const row of catchupTxs) {
      // Use the YYYY-MM-DD string to avoid object-to-string mismatches
      const dateObj = new Date(row.created_at);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;
      
      const key = `${row.plan_id}_${localDateStr}`;
      if (!planGroups[key]) planGroups[key] = [];
      planGroups[key].push(row);
    }
    
    let correctRefundCount = 0;
    let correctRefundTotal = 0;

    for (const key in planGroups) {
      const txs = planGroups[key];
      
      // If there's more than 1 catchup for the same plan on the same day, the extras are duplicates due to the race condition.
      if (txs.length > 1) {
        // Keep the first transaction (the legitimate catchup), refund and delete all subsequent ones
        for (let i = 1; i < txs.length; i++) {
          const tx = txs[i];
          const amount = parseFloat(tx.amount);
          
          console.log(`[Reconciling Duplicate] Plan: ${tx.plan_id} | User: ${tx.user_id} | Amount: ₦${amount} | Ref: ${tx.reference}`);

          // 1. Credit wallet back to the user
          await client.query(
            'UPDATE users SET available_balance = available_balance + $1, wallet_balance = wallet_balance + $1 WHERE id = $2',
            [amount, tx.user_id]
          );

          // 2. Debit the savings plan (undo the false progression)
          await client.query(
            'UPDATE savings_plans SET current_amount = current_amount - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [amount, tx.plan_id]
          );

          // 3. Mark duplicate transaction as reversed so it no longer contributes to calculations but leaves a trail, 
          // or delete it entirely. We will mark it as 'reversed' for audit safety.
          await client.query(
            "UPDATE transactions SET status = 'reversed', updated_at = CURRENT_TIMESTAMP WHERE id = $1", 
            [tx.id]
          );

          // 4. Create proper ledger entry explaining the refund to the user
          const newRef = `RECONCILE-${Date.now()}-${tx.id.substring(0,5)}`;
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, reference, description)
             VALUES ($1, 'credit', $2, $3, $4)`,
            [tx.user_id, amount, newRef, `System refund: Reversal of duplicate catch-up deduction`]
          );

          correctRefundCount++;
          correctRefundTotal += amount;
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n--- RECONCILIATION COMPLETE ---');
    console.log(`Processed ${correctRefundCount} correct refunds for a total of ₦${correctRefundTotal.toLocaleString()}.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during reconciliation:', err);
  } finally {
    client.release();
    process.exit(0);
  }
};

runProductionReconciliation();
