/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS event_key VARCHAR(255);
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_key
    ON notifications(event_key);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_notifications_event_key;
    ALTER TABLE notifications DROP COLUMN IF EXISTS event_key;
  `);
};
