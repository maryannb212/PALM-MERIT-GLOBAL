import { query } from './src/config/db.js';

async function queryMismatches() {
  try {
    const { rows: logs } = await query(`
      SELECT reference, note, created_at
      FROM webhook_logs
      WHERE status = 'error'
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    for (const log of logs) {
      console.log('Webhook Log:', log);
      if (log.reference) {
        const { rows: txs } = await query(`
          SELECT * FROM transactions WHERE reference = $1
        `, [log.reference]);
        console.log('Transaction:', txs[0] || 'NOT FOUND');
      }
      console.log('-----------------------------');
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

queryMismatches();
