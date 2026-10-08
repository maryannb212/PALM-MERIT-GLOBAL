/**
 * Backfill the per-account clearance column for databases created before the
 * clearance feature was introduced.
 * @param { import('knex').Knex } knex
 */
export const up = async function(knex) {
  await knex.raw(`
    ALTER TABLE savings_plans
      ADD COLUMN IF NOT EXISTS accounts_cleared INTEGER NOT NULL DEFAULT 0;
    UPDATE savings_plans
      SET accounts_cleared = LEAST(
        COALESCE(number_of_accounts, 1),
        GREATEST(COALESCE(accounts_cleared, 0), 0)
      );
  `);
};

export const down = async function(knex) {
  await knex.raw('ALTER TABLE savings_plans DROP COLUMN IF EXISTS accounts_cleared');
};
