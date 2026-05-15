/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    -- Make email optional
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    
    -- Drop the unique constraint on email
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

    -- Make phone unique (we add IF NOT EXISTS equivalent logic using a trick or just run it and hope there are no duplicates)
    -- Actually, postgres doesn't support ADD CONSTRAINT IF NOT EXISTS directly.
    -- We'll just add it. If there are duplicates, the migration will fail, which is intended.
    ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    -- Revert email to not null (will fail if there are nulls)
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
    
    -- Re-add unique constraint on email
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);

    -- Drop phone unique constraint
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
  `);
};
