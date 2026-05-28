/**
 * RECONCILIATION SCRIPT
 * =====================
 * Finds all pending transactions that have a corresponding successful 
 * webhook log entry and processes them to credit user wallets.
 * 
 * This fixes the issue where some users paid but never saw their balance
 * updated due to a tx_ref parsing bug (indexOf vs lastIndexOf).
 * 
 * Run: node reconcile_pending_payments.js
 * Dry run (no changes): node reconcile_pending_payments.js --dry-run
 */

import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isDryRun = process.argv.includes('--dry-run');

async function reconcile() {
  const client = await pool.connect();
  
  try {
    console.log('==============================================');
    console.log('PAYMENT RECONCILIATION SCRIPT');
    console.log(isDryRun ? '*** DRY RUN MODE — NO CHANGES WILL BE MADE ***' : '*** LIVE MODE — CHANGES WILL BE APPLIED ***');
    console.log('==============================================\n');

    // =========================================================
    // STEP 1: Find error webhook logs with VA- references
    // =========================================================
    
    const { rows: errorLogs } = await client.query(`
      SELECT id, reference, payload, note, created_at 
      FROM webhook_logs 
      WHERE status = 'error' 
        AND reference LIKE 'VA-%'
      ORDER BY created_at DESC
    `);

    console.log(`Found ${errorLogs.length} error webhook logs with VA- references\n`);

    let reconciled = 0;
    let skipped = 0;
    let errors = 0;

    for (const log of errorLogs) {
      const ref = log.reference;
      const payload = log.payload;
      const data = payload?.data || payload;
      const amount = Number(data?.amount || 0);

      console.log(`\n--- Processing: ${ref} ---`);
      console.log(`  Amount: ₦${amount}`);
      console.log(`  Error: ${log.note}`);
      console.log(`  Date: ${log.created_at}`);

      // Parse userId from tx_ref
      const prefixRemoved = ref.replace('VA-', '');
      const lastHyphenIndex = prefixRemoved.lastIndexOf('-');
      if (lastHyphenIndex === -1) {
        console.log('  ❌ Cannot parse userId from reference — skipping');
        skipped++;
        continue;
      }

      const potentialId = prefixRemoved.substring(0, lastHyphenIndex);
      if (!UUID_REGEX.test(potentialId)) {
        console.log(`  ❌ Parsed non-UUID: "${potentialId}" — skipping`);
        skipped++;
        continue;
      }

      // Check user exists
      const { rows: userRows } = await client.query(
        'SELECT id, first_name, last_name, available_balance, wallet_balance FROM users WHERE id = $1',
        [potentialId]
      );

      if (userRows.length === 0) {
        console.log(`  ❌ User ${potentialId} not found — skipping`);
        skipped++;
        continue;
      }

      const user = userRows[0];
      console.log(`  👤 User: ${user.first_name} ${user.last_name}`);
      console.log(`  💰 Current balance: ₦${user.available_balance || 0}`);

      // Check if transaction already exists
      const { rows: existingTx } = await client.query(
        'SELECT id, status, amount FROM transactions WHERE reference = $1',
        [ref]
      );

      if (existingTx.length > 0 && existingTx[0].status === 'completed') {
        console.log(`  ✅ Transaction already completed — skipping`);
        skipped++;
        continue;
      }

      if (amount <= 0) {
        console.log('  ❌ Invalid amount — skipping');
        skipped++;
        continue;
      }

      if (isDryRun) {
        console.log(`  🔍 DRY RUN: Would create/complete transaction and credit ₦${amount} to ${user.first_name} ${user.last_name}`);
        reconciled++;
        continue;
      }

      // =========================================================
      // STEP 2: Apply fix inside a DB transaction
      // =========================================================

      try {
        await client.query('BEGIN');

        // Create transaction record if it doesn't exist
        if (existingTx.length === 0) {
          await client.query(
            `INSERT INTO transactions (user_id, type, amount, reference, payment_provider, status)
             VALUES ($1, 'wallet_topup', $2, $3, 'flutterwave', 'pending')
             ON CONFLICT (reference) DO NOTHING`,
            [potentialId, amount, ref]
          );
          console.log('  📝 Created transaction record');
        }

        // Lock and update transaction
        const { rows: lockRows } = await client.query(
          'SELECT * FROM transactions WHERE reference = $1 FOR UPDATE',
          [ref]
        );

        if (lockRows.length === 0) {
          await client.query('ROLLBACK');
          console.log('  ❌ Failed to lock transaction — skipping');
          errors++;
          continue;
        }

        const tx = lockRows[0];

        if (tx.status === 'completed') {
          await client.query('ROLLBACK');
          console.log('  ✅ Transaction already completed (race condition) — skipping');
          skipped++;
          continue;
        }

        // Mark transaction completed
        await client.query(
          `UPDATE transactions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE reference = $1`,
          [ref]
        );

        // Credit user wallet
        await client.query(
          `UPDATE users 
           SET available_balance = COALESCE(available_balance, 0) + $1,
               wallet_balance = COALESCE(wallet_balance, 0) + $1
           WHERE id = $2`,
          [amount, potentialId]
        );

        // Update webhook log status
        await client.query(
          `UPDATE webhook_logs SET status = 'reconciled', note = $1 WHERE id = $2`,
          [`Reconciled: Credited ₦${amount} to user ${potentialId}`, log.id]
        );

        await client.query('COMMIT');

        // Verify the new balance
        const { rows: updatedUser } = await client.query(
          'SELECT available_balance, wallet_balance FROM users WHERE id = $1',
          [potentialId]
        );

        console.log(`  ✅ RECONCILED: Credited ₦${amount}`);
        console.log(`  💰 New balance: ₦${updatedUser[0]?.available_balance || 0}`);
        reconciled++;

      } catch (txErr) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Error: ${txErr.message}`);
        errors++;
      }
    }

    // =========================================================
    // STEP 3: Also check pending transactions without webhook logs
    // =========================================================

    console.log('\n\n==============================================');
    console.log('CHECKING PENDING TRANSACTIONS (no webhook match)');
    console.log('==============================================\n');

    const { rows: pendingTx } = await client.query(`
      SELECT t.id, t.reference, t.amount, t.user_id, t.created_at, t.payment_provider,
             u.first_name, u.last_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'pending' 
        AND t.type IN ('wallet_topup', 'deposit')
        AND t.created_at < NOW() - INTERVAL '1 hour'
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

    console.log(`Found ${pendingTx.length} old pending transactions:\n`);
    for (const tx of pendingTx) {
      console.log(`  📋 ${tx.reference}`);
      console.log(`     User: ${tx.first_name} ${tx.last_name} | Amount: ₦${tx.amount} | Provider: ${tx.payment_provider} | Date: ${tx.created_at}`);
    }

    // =========================================================
    // SUMMARY
    // =========================================================

    console.log('\n\n==============================================');
    console.log('RECONCILIATION SUMMARY');
    console.log('==============================================');
    console.log(`  Reconciled: ${reconciled}`);
    console.log(`  Skipped:    ${skipped}`);
    console.log(`  Errors:     ${errors}`);
    console.log(`  Mode:       ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('==============================================\n');

  } catch (err) {
    console.error('FATAL ERROR:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

reconcile();
