/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function(knex) {
  await knex.raw(`
    -- Add indexes to foreign keys to improve query performance
    CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);
    CREATE INDEX IF NOT EXISTS idx_savings_plans_user_id ON savings_plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_plan_id ON transactions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_kyc_details_user_id ON kyc_details(user_id);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
    CREATE INDEX IF NOT EXISTS idx_payouts_plan_id ON payouts(plan_id);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_details_transaction_id ON withdrawal_details(transaction_id);
    
    -- Add index for status lookups which are frequent in dashboard/admin
    CREATE INDEX IF NOT EXISTS idx_savings_plans_status ON savings_plans(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_otp_codes_user_id;
    DROP INDEX IF EXISTS idx_savings_plans_user_id;
    DROP INDEX IF EXISTS idx_transactions_user_id;
    DROP INDEX IF EXISTS idx_transactions_plan_id;
    DROP INDEX IF EXISTS idx_kyc_details_user_id;
    DROP INDEX IF EXISTS idx_bank_accounts_user_id;
    DROP INDEX IF EXISTS idx_payouts_user_id;
    DROP INDEX IF EXISTS idx_payouts_plan_id;
    DROP INDEX IF EXISTS idx_withdrawal_details_transaction_id;
    DROP INDEX IF EXISTS idx_savings_plans_status;
    DROP INDEX IF EXISTS idx_transactions_status;
  `);
};
