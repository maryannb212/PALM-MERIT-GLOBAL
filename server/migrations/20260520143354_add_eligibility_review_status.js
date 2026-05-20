/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Drop the existing constraint
  await knex.raw('ALTER TABLE savings_plans DROP CONSTRAINT IF EXISTS savings_plans_status_check');
  
  // Add the new constraint with 'eligibility_review'
  await knex.raw("ALTER TABLE savings_plans ADD CONSTRAINT savings_plans_status_check CHECK (status IN ('active', 'completed', 'cancelled', 'matured', 'eligibility_review', 'pending_clearance', 'pending_settlement', 'settled'))");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // To revert, we should probably safely drop it and add the old one back
  // (Note: if any records have 'eligibility_review', this down migration might fail unless those records are updated first)
  await knex.raw('ALTER TABLE savings_plans DROP CONSTRAINT IF EXISTS savings_plans_status_check');
  await knex.raw("ALTER TABLE savings_plans ADD CONSTRAINT savings_plans_status_check CHECK (status IN ('active', 'completed', 'cancelled', 'matured', 'pending_clearance', 'pending_settlement', 'settled'))");
};
