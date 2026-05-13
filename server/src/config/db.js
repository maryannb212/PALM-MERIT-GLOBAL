import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Use DATABASE_URL for Neon production, fallback to local params for dev
const connectionString = process.env.DATABASE_URL;

const poolConfig = {
  connectionString,
  // Enable SSL for production or any cloud database (Neon, Railway, etc.)
  ssl: (connectionString && (
    process.env.NODE_ENV === 'production' ||
    connectionString.includes('neon.tech') ||
    connectionString.includes('railway') ||
    connectionString.includes('sslmode=require')
  )) ? { rejectUnauthorized: false } : false,
  max: process.env.DEPLOY_MODE === 'serverless' ? 3 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// If connectionString is missing and we're not in production, use local defaults
if (!connectionString && process.env.NODE_ENV !== 'production') {
  Object.assign(poolConfig, {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'palmmerit',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('--- DB Pool: New client connected ---');
});

pool.on('error', (err) => {
  console.error('--- DB Pool: Unexpected error on idle client ---', err.message);
  // Re-emit error to trigger application-level handling if needed
});

/**
 * Executes a query using the pool
 */
export const query = (text, params) => {
  const start = Date.now();
  return pool.query(text, params).then(res => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      // console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  });
};

/**
 * Gets a client from the pool for transactions
 */
export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);

  // monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
};

export default pool;
