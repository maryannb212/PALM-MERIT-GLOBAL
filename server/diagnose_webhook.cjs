'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_JkeRXvsLZy95@ep-old-firefly-apo2kaxr.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('\n========== LATEST 5 LOTUS WEBHOOK LOGS ==========');
  const { rows: logs } = await pool.query(`
    SELECT id, source, reference, event_type, signature_ok, status, note, payload, created_at
    FROM webhook_logs
    WHERE source = 'lotus'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  logs.forEach(l => {
    const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
    console.log(`\n[${l.created_at.toISOString().slice(0,19)}] status=${l.status} | ref=${l.reference}`);
    console.log(`  note: ${l.note || 'none'}`);
    console.log(`  amount: ${p?.data?.amount}`);
    console.log(`  reserved_account present: ${!!(p?.data?.reserved_account)}`);
    console.log(`  acct_number: ${p?.data?.reserved_account?.account_details?.account_number || 'N/A'}`);
    console.log(`  sig_ok: ${l.signature_ok}`);
  });

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
