/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS referral_expiry_date TIMESTAMP DEFAULT NULL;
  `);

  // Optionally set existing users' expiry dates based on their unlock dates if they exist.
  // For simplicity, we just leave them null, which we will treat as never expired or we can set them to unlock_date + 14 days if they have an unlock date.
  await knex.raw(`
    UPDATE users 
    SET referral_expiry_date = referral_unlock_date + INTERVAL '14 days'
    WHERE referral_unlock_date IS NOT NULL AND referral_expiry_date IS NULL;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    ALTER TABLE users 
    DROP COLUMN IF EXISTS referral_expiry_date;
  `);
};
