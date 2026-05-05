import pool from './config/db.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tshirt_paid BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tshirt_payment_date TIMESTAMP WITH TIME ZONE;`);

    const { rows } = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'savings_plans'::regclass AND contype = 'c';
    `);
    
    for (let row of rows) {
      if (row.def.includes('status')) {
         await client.query(`ALTER TABLE savings_plans DROP CONSTRAINT ${row.conname};`);
      }
    }
    
    await client.query(`ALTER TABLE savings_plans ADD CONSTRAINT savings_plans_status_check CHECK (status IN ('active', 'matured', 'pending_clearance', 'cleared', 'pending_settlement', 'settled', 'cancelled'));`);

    await client.query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS maturity_date TIMESTAMP WITH TIME ZONE;`);
    await client.query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS clearance_required BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS clearance_paid BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS clearance_date TIMESTAMP WITH TIME ZONE;`);
    await client.query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS payout_date TIMESTAMP WITH TIME ZONE;`);
    await client.query(`ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS payout_status VARCHAR(50);`);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID NOT NULL REFERENCES savings_plans(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2),
        payout_type VARCHAR(20) CHECK (payout_type IN ('cash', 'goods')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'failed')),
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('Migration successful');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
