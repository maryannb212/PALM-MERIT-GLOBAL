import { query } from '../config/db.js';

const terms = ['clear this default', 'pay this week contribution', 'how to clear'];

const { rows: tables } = await query(`
  SELECT table_name, column_name FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND data_type IN ('text', 'character varying', 'json', 'jsonb')
`);

let found = false;
for (const { table_name, column_name } of tables) {
  for (const term of terms) {
    const sql = `SELECT id, ${column_name}::text as val FROM ${table_name} WHERE ${column_name}::text ILIKE $1 LIMIT 5`;
    try {
      const { rows } = await query(sql, [`%${term}%`]);
      if (rows.length > 0) {
        found = true;
        console.log(`\n=== ${table_name}.${column_name} (term: "${term}") ===`);
        rows.forEach(r => console.log(`  [${r.id}] ${(r.val || '').substring(0, 200)}`));
      }
    } catch (e) { /* skip */ }
  }
}

if (!found) console.log('No matches found in database.');
process.exit(0);
