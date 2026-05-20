import { query } from './src/config/db.js';

const setup = async () => {
  try {
    console.log('Creating page_locks table...');
    await query(`
      CREATE TABLE IF NOT EXISTS page_locks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        page_name VARCHAR(100) UNIQUE NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table page_locks created successfully.');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    process.exit(0);
  }
};

setup();
