/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    ALTER TABLE referral_codes 
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
  `);

  // Set expiry for existing codes based on their plan type
  // CREST: 14 days from creation, SILVER/GOLDEN_BASKET: 90 days, ISUSU: 14 days
  await knex.raw(`
    UPDATE referral_codes rc
    SET expires_at = rc.created_at + CASE
      WHEN sp.plan_name = 'CREST' THEN INTERVAL '14 days'
      WHEN sp.plan_name = 'SILVER' THEN INTERVAL '90 days'
      WHEN sp.plan_name = 'GOLDEN_BASKET' THEN INTERVAL '90 days'
      WHEN sp.plan_name = 'ISUSU' THEN INTERVAL '14 days'
      ELSE INTERVAL '14 days'
    END
    FROM savings_plans sp
    WHERE rc.plan_id = sp.id AND rc.expires_at IS NULL;
  `);

  // Mark codes past their expires_at as 'expired' (only if currently 'available' or 'locked')
  await knex.raw(`
    UPDATE referral_codes
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
    AND status IN ('available', 'locked');
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    ALTER TABLE referral_codes 
    DROP COLUMN IF EXISTS expires_at;
  `);
};
