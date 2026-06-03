/* Migration: add is_test flag to transactions */

-- File: 20260602_add_is_test_to_transactions.sql
-- Description: Adds a boolean column `is_test` to transactions to flag test payments.

ALTER TABLE transactions
ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT FALSE;
