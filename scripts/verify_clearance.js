#!/usr/bin/env node

/**
 * verify_clearance.js
 *
 * Quick sanity‑check for the “clearance” transaction type.
 * 1. Creates a dummy user (if not already present).
 * 2. Creates a dummy savings plan for that user.
 * 3. Inserts a clearance transaction referencing the plan.
 * 4. Calls processCompletedPayment(reference) to trigger the clearance logic.
 * 5. Prints the updated plan, payout record and transaction.
 *
 * Run with:
 *   node scripts/verify_clearance.js
 *
 * Ensure you have the project dependencies installed (npm install) and the
 * environment variables loaded (e.g. source .env.production.example or .env).
 */

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../server/src/config/db.js';
import { createTransaction, processCompletedPayment } from '../server/src/models/transactionModel.js';
import { createUser } from '../server/src/models/userModel.js';

/** Helper – fetch a row by its id (used for debugging prints) */
async function fetchRow(table, idColumn, id) {
  const { rows } = await query(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [id]);
  return rows[0];
}

(async () => {
  try {
    // Load env (needed for DB connection)
    dotenv.config({ path: '.env.production.example' });

    // ---- 1️⃣ Dummy user ----
    const dummyEmail = 'clearance_test_user@example.com';
    let userResult = await query('SELECT * FROM users WHERE email = $1', [dummyEmail]);
    let user;
    if (userResult.rows.length === 0) {
      const passwordHash = await bcrypt.hash('TempPass123!', 10);
      user = await createUser('Clearance', 'Tester', dummyEmail, passwordHash, '+2347000000000');
      console.log('🔹 Created dummy user →', user);
    } else {
      user = userResult.rows[0];
      console.log('🔹 Dummy user already exists →', user.id);
    }

    // ---- 2️⃣ Dummy savings plan ----
    const planName = 'CLEARANCE_TEST_PLAN';
    const planResult = await query(
      `INSERT INTO savings_plans (user_id, plan_name, target_amount, current_amount, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (plan_name, user_id) DO UPDATE SET target_amount = EXCLUDED.target_amount
       RETURNING *;`,
      [user.id, planName, 200000, 0, 'active']
    );
    const plan = planResult.rows[0];
    console.log('🔹 Savings plan →', plan.id, plan.plan_name);

    // ---- 3️⃣ Clearance transaction ----
    const reference = `CL-${uuidv4().substring(0, 8).toUpperCase()}`;
    const clearanceTx = await createTransaction(user.id, plan.id, 'clearance', 0, reference, 'flutterwave');
    console.log('🔹 Clearance transaction created →', clearanceTx.reference);

    // ---- 4️⃣ Process clearance ----
    console.log('🚀 Running processCompletedPayment...');
    const result = await processCompletedPayment(reference);
    console.log('✅ processCompletedPayment finished. Result:', {
      isDuplicate: result.isDuplicate,
      transactionId: result.transaction.id,
    });

    // ---- 5️⃣ Verify updates ----
    const updatedPlan = await fetchRow('savings_plans', 'id', plan.id);
    const payoutRes = await query('SELECT * FROM payouts WHERE plan_id = $1 ORDER BY created_at DESC LIMIT 1', [plan.id]);
    const payout = payoutRes.rows[0];
    console.log('\n--- Verification ---');
    console.log('🔎 Updated Savings Plan:', {
      status: updatedPlan.status,
      clearance_paid: updatedPlan.clearance_paid,
      clearance_date: updatedPlan.clearance_date,
      payout_date: updatedPlan.payout_date,
    });
    console.log('💰 Payout Record:', payout);
    console.log('🔁 Transaction (should be completed):', result.transaction);

    // ---- 6️⃣ Idempotency test ----
    const secondRun = await processCompletedPayment(reference);
    console.log('\n🔁 Idempotency test – second run result:', secondRun);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error during verification:', err);
    process.exit(1);
  }
})();
