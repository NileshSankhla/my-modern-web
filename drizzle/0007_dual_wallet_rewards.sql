DO $$
BEGIN
  CREATE TYPE wallet_type AS ENUM ('cashback', 'amazon_rewards');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE gift_card_request_status AS ENUM ('pending', 'approved', 'fulfilled', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS wallet_type wallet_type NOT NULL DEFAULT 'cashback';

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS wallet_type wallet_type NOT NULL DEFAULT 'cashback';

ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_key;
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_unique;
ALTER TABLE wallets
  ADD CONSTRAINT wallets_user_id_wallet_type_unique UNIQUE (user_id, wallet_type);

INSERT INTO wallets (user_id, wallet_type, balance_in_paise, updated_at, created_at)
SELECT users.id, 'amazon_rewards', 0, NOW(), NOW()
FROM users
ON CONFLICT (user_id, wallet_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS amazon_gift_card_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_in_paise INTEGER NOT NULL,
  status gift_card_request_status NOT NULL DEFAULT 'pending',
  gift_card_code TEXT,
  admin_note TEXT,
  processed_by_admin_id INTEGER REFERENCES users(id),
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT amazon_gift_card_requests_amount_positive CHECK (amount_in_paise > 0)
);

CREATE INDEX IF NOT EXISTS amazon_gift_card_requests_user_id_idx ON amazon_gift_card_requests(user_id);
CREATE INDEX IF NOT EXISTS amazon_gift_card_requests_user_status_created_at_idx ON amazon_gift_card_requests(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS amazon_gift_card_requests_status_idx ON amazon_gift_card_requests(status);
CREATE INDEX IF NOT EXISTS amazon_gift_card_requests_created_at_idx ON amazon_gift_card_requests(created_at);
