/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS referral_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id UUID REFERENCES savings_plans(id) ON DELETE CASCADE,
      code VARCHAR(50) UNIQUE NOT NULL,
      status VARCHAR(20) DEFAULT 'available',
      used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      unlock_date TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
    CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS referral_codes CASCADE;
  `);
};
