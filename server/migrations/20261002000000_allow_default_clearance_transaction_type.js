/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw('LOCK TABLE transactions IN ACCESS EXCLUSIVE MODE');

  const existingTypes = await knex('transactions').distinct('type').pluck('type');
  const allowedTypes = new Set([
    'deposit', 'withdrawal', 'penalty', 'membership', 'interest',
    'wallet_topup', 'clearance', 'contribution', 'savings', 'refund',
    'registration', 'penalty_settlement', 'default_clearance', 'admin_settlement',
    ...existingTypes.filter((type) => typeof type === 'string')
  ]);
  const typeList = [...allowedTypes]
    .map((type) => `'${type.replaceAll("'", "''")}'`)
    .join(', ');

  await knex.raw(`
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
      CHECK (type IN (${typeList}));
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function() {
  // Keep the transaction type available after clearance records are created.
};