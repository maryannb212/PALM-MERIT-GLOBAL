/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  // 1. Add referral columns to users table
  await knex.raw(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS referral_unlock_date TIMESTAMP DEFAULT NULL;
  `);

  // 2. Generate unique referral codes for any existing users
  const existingUsers = await knex('users').select('id', 'first_name', 'last_name', 'created_at');
  for (const user of existingUsers) {
    const f = (user.first_name || 'P').charAt(0).toUpperCase();
    const l = (user.last_name || 'M').charAt(0).toUpperCase();
    const initials = `${f}X${l}`;
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const code = `${initials}-${randomNum}`;

    const unlockDate = new Date(user.created_at || new Date());
    unlockDate.setMonth(unlockDate.getMonth() + 1); // exactly 1 month from registration

    await knex('users')
      .where({ id: user.id })
      .update({
        referral_code: code,
        referral_unlock_date: unlockDate
      });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    ALTER TABLE users 
    DROP COLUMN IF EXISTS referral_code,
    DROP COLUMN IF EXISTS referred_by,
    DROP COLUMN IF EXISTS referral_unlock_date;
  `);
};
