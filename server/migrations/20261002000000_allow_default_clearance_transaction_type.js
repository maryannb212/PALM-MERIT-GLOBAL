/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
      CHECK (type IN (
        'deposit', 'withdrawal', 'penalty', 'membership', 'interest',
        'wallet_topup', 'clearance', 'contribution', 'savings', 'refund',
        'registration', 'penalty_settlement', 'default_clearance', 'admin_settlement'
      ));
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function() {
  // Keep the transaction type available after clearance records are created.
};