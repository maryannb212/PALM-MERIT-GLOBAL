-- Migration: Add partial unique index on transactions.reference to enforce uniqueness for non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reference_unique ON transactions(reference) WHERE reference IS NOT NULL;
