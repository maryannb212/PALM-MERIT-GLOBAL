import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_JkeRXvsLZy95@ep-old-firefly-apo2kaxr.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // 1. Show YOUR account balance
    console.log('=== YOUR ACCOUNT ===');
    const { rows: me } = await pool.query(`
      SELECT id, email, first_name, wallet_balance, available_balance, has_paid_membership, virtual_account_number
      FROM users WHERE email = 'chidinduprosper1@gmail.com'
    `);
    console.table(me);

    // 2. Show ALL transactions for your account in last 48h
    console.log('\n=== YOUR RECENT TRANSACTIONS (48h) ===');
    const { rows: txs } = await pool.query(`
      SELECT t.id, t.type, t.status, t.amount, t.reference, t.created_at
      FROM transactions t
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [me[0]?.id]);
    console.table(txs);

    // 3. Show wallet_transactions / ledger entries
    console.log('\n=== WALLET LEDGER ENTRIES ===');
    const { rows: ledger } = await pool.query(`
      SELECT * FROM wallet_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [me[0]?.id]);
    console.table(ledger);

    // 4. Show ALL recent completed transactions across ALL users (last 24h)
    console.log('\n=== ALL COMPLETED TRANSACTIONS (24h) ===');
    const { rows: all } = await pool.query(`
      SELECT t.reference, t.type, t.status, t.amount, u.email, u.first_name, t.created_at
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.created_at >= NOW() - INTERVAL '24 hours'
      AND t.status = 'completed'
      ORDER BY t.created_at DESC
    `);
    console.table(all);

  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();
