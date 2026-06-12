import { query } from './server/src/config/db.js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function find() {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', ['odogoedwin@gmail.com']);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
find();
