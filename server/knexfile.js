import dotenv from 'dotenv';
dotenv.config();

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    } : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'palmmerit',
      port: process.env.DB_PORT || 5432,
    },
    migrations: {
      directory: './migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      connectionString: process.env.DATABASE_URL,
      // SSL required for Neon PostgreSQL on Railway
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 2,
      max: 10,
      // Destroy idle connections after 30s (prevents Neon idle timeouts)
      idleTimeoutMillis: 30000,
      // Give up connecting after 10s
      acquireTimeoutMillis: 10000,
    },
    migrations: {
      directory: './migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },
};
