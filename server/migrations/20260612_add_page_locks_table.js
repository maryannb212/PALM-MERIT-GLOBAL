/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS page_locks (
      id SERIAL PRIMARY KEY,
      page_name VARCHAR(100) UNIQUE NOT NULL,
      username VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`DROP TABLE IF EXISTS page_locks`);
};
