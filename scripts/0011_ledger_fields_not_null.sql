-- Migration: 0011_ledger_fields_not_null.sql
-- 
-- After successful backfill, enforce that all new transactions
-- must have wallet_id, sequence_number, and balance_after_in_paise.
-- 
-- PREREQUISITE: scripts/backfill-ledger-complete.mjs must complete
-- with zero errors before applying this migration.

-- Step 1: Verify no NULL values remain (fails migration if backfill incomplete)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM wallet_transactions 
    WHERE wallet_id IS NULL 
       OR sequence_number IS NULL 
       OR balance_after_in_paise IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply migration: NULL values exist in ledger fields. Run backfill script first.';
  END IF;
END $$;

-- Step 2: Make columns NOT NULL
ALTER TABLE wallet_transactions 
  ALTER COLUMN wallet_id SET NOT NULL;

ALTER TABLE wallet_transactions 
  ALTER COLUMN sequence_number SET NOT NULL;

ALTER TABLE wallet_transactions 
  ALTER COLUMN balance_after_in_paise SET NOT NULL;

-- Step 3: Add CHECK constraint (balance should never be negative)
-- This is a safety net; legitimate operations should never produce negative balances
ALTER TABLE wallet_transactions 
  ADD CONSTRAINT wallet_transactions_balance_non_negative 
  CHECK (balance_after_in_paise >= 0);

-- Step 4: Add unique constraint on sequence_number per wallet
-- Ensures no gaps or duplicates in the sequence
ALTER TABLE wallet_transactions 
  ADD CONSTRAINT wallet_transactions_sequence_unique_per_wallet 
  UNIQUE (wallet_id, sequence_number);

-- Step 5: Create index for sequence-based queries (reconciliation, audit)
CREATE INDEX idx_wallet_transactions_wallet_sequence 
  ON wallet_transactions (wallet_id, sequence_number);

-- Step 6: Create partial index for finding gaps in sequences
-- This enables efficient gap detection in reconciliation
CREATE INDEX idx_wallet_transactions_sequence_for_gaps 
  ON wallet_transactions (wallet_id, sequence_number)
  WHERE wallet_id IS NOT NULL;

COMMENT ON CONSTRAINT wallet_transactions_balance_non_negative ON wallet_transactions IS 
  'Safety constraint: balance_after_paise should never be negative for legitimate transactions. Violations indicate a bug or data corruption.';