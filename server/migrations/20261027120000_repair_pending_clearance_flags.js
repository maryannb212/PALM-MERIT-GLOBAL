/**
 * Restore the clearance flag for plans already in the clearance payment state.
 * @param { import('knex').Knex } knex
 */
export const up = async function(knex) {
  await knex.raw(`
    UPDATE savings_plans
    SET clearance_required = TRUE,
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending_clearance'
      AND clearance_required IS DISTINCT FROM TRUE
  `);
};

export const down = async function() {
  throw new Error('This data repair is irreversible; pending clearance flags must remain enabled.');
};
