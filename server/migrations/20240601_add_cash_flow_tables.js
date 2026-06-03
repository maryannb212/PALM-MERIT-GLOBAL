import * as knex from 'knex';

export const up = async function (knexInstance) {
  await knexInstance.schema.createTable('cash_flow_daily', (table) => {
    table.date('date').primary();
    table.decimal('total_inflow', 14, 2).notNullable().defaultTo(0);
    table.decimal('total_outflow', 14, 2).notNullable().defaultTo(0);
    table.decimal('balance', 14, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  await knexInstance.schema.createTable('cash_flow_category_totals', (table) => {
    table.string('category').notNullable();
    table.decimal('total_amount', 14, 2).notNullable().defaultTo(0);
    table.date('date').notNullable();
    table.primary(['category', 'date']);
    table.timestamps(true, true);
  });

  // Add split_details JSON column to transactions for audit trail
  const hasColumn = await knexInstance.schema.hasColumn('transactions', 'split_details');
  if (!hasColumn) {
    await knexInstance.schema.alterTable('transactions', (table) => {
      table.jsonb('split_details');
    });
  }
};

export const down = async function (knexInstance) {
  await knexInstance.schema.dropTableIfExists('cash_flow_category_totals');
  await knexInstance.schema.dropTableIfExists('cash_flow_daily');
  const hasColumn = await knexInstance.schema.hasColumn('transactions', 'split_details');
  if (hasColumn) {
    await knexInstance.schema.alterTable('transactions', (table) => {
      table.dropColumn('split_details');
    });
  }
};
