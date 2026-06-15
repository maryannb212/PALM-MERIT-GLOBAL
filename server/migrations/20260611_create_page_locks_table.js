/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS page_locks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_name VARCHAR(100) NOT NULL UNIQUE,
      username VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS page_locks CASCADE;
  `);
};
