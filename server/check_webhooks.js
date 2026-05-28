import { query } from './src/config/db.js';

async function checkWebhooks() {
  try {
    const { rows } = await query(`
      SELECT source, event_type, status, note, reference
      FROM webhook_logs
      ORDER BY created_at DESC
      LIMIT 15
    `);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

checkWebhooks();
