/**
 * Add auditable Crest policy controls without changing other programmes.
 * @param { import('knex').Knex } knex
 */
export const up = async function(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS terms_acceptances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      terms_version VARCHAR(40) NOT NULL,
      acceptance_type VARCHAR(30) NOT NULL,
      accepted BOOLEAN NOT NULL DEFAULT FALSE,
      accepted_at TIMESTAMP WITH TIME ZONE,
      ip_address INET,
      user_agent TEXT,
      transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT terms_acceptance_type_check CHECK (acceptance_type IN ('REGISTRATION', 'FUNDING'))
    );

    CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user_type
      ON terms_acceptances(user_id, acceptance_type, created_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_terms_acceptances_user_version_type
      ON terms_acceptances(user_id, terms_version, acceptance_type);

    CREATE TABLE IF NOT EXISTS referral_reassignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
      previous_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      new_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
      actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      previous_status VARCHAR(20),
      new_status VARCHAR(20),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_referral_reassignments_code
      ON referral_reassignments(referral_code_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS crest_eligibility_evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id UUID NOT NULL REFERENCES savings_plans(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_eligible BOOLEAN NOT NULL,
      direct_referral_id UUID REFERENCES users(id) ON DELETE SET NULL,
      direct_weeks INTEGER NOT NULL DEFAULT 0,
      second_level_referral_id UUID REFERENCES users(id) ON DELETE SET NULL,
      second_level_weeks INTEGER NOT NULL DEFAULT 0,
      cumulative_weeks INTEGER NOT NULL DEFAULT 0,
      programme_completed BOOLEAN NOT NULL DEFAULT FALSE,
      clearance_completed BOOLEAN NOT NULL DEFAULT FALSE,
      earliest_settlement_date TIMESTAMP WITH TIME ZONE,
      latest_settlement_date TIMESTAMP WITH TIME ZONE,
      reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      evaluated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_crest_eligibility_plan_created
      ON crest_eligibility_evaluations(plan_id, created_at DESC);

    ALTER TABLE savings_plans
      ADD COLUMN IF NOT EXISTS completion_date TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS earliest_settlement_date TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS latest_settlement_date TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS settled_by UUID REFERENCES users(id) ON DELETE SET NULL;
  `);
};

/**
 * @param { import('knex').Knex } knex
 */
export const down = async function(knex) {
  await knex.raw(`
    ALTER TABLE savings_plans
      DROP COLUMN IF EXISTS settled_by,
      DROP COLUMN IF EXISTS settled_at,
      DROP COLUMN IF EXISTS latest_settlement_date,
      DROP COLUMN IF EXISTS earliest_settlement_date,
      DROP COLUMN IF EXISTS completion_date;
    DROP TABLE IF EXISTS crest_eligibility_evaluations CASCADE;
    DROP TABLE IF EXISTS referral_reassignments CASCADE;
    DROP TABLE IF EXISTS terms_acceptances CASCADE;
  `);
};
