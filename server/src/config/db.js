import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'palmmerit',
  port: process.env.DB_PORT || 5432,
};

if (process.env.DB_HOST) {
  dbConfig.host = process.env.DB_HOST;
}

if (process.env.DB_PASSWORD) {
  dbConfig.password = process.env.DB_PASSWORD;
}

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL Database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
