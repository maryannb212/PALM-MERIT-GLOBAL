-- Migration 002: Strict Duplicate Transaction Protection
-- Adds named UNIQUE constraint on transactions.reference and webhook audit log table

-- ─────────────────────────────────────────────────────────────────
-- 1. Named UNIQUE constraint on transactions.reference
--    (column already has UNIQUE inline, this adds the named version
--     so ON CONFLICT can reference it explicitly and error messages
--     are clear in pg logs)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_transaction_reference'
      AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT unique_transaction_reference UNIQUE (reference);
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────
-- 2. Webhook audit log table
--    Records every inbound webhook call for forensic analysis
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        VARCHAR(50)  NOT NULL DEFAULT 'paystack',   -- paystack | lotus
  reference     VARCHAR(100),
  event_type    VARCHAR(100),
  payload       JSONB,
  signature_ok  BOOLEAN      NOT NULL DEFAULT FALSE,
  status        VARCHAR(20)  NOT NULL DEFAULT 'received',   -- received | processed | duplicate | rejected | error
  note          TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_reference
  ON webhook_logs (reference);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at
  ON webhook_logs (created_at);
