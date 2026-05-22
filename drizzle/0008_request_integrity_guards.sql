CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_source_click_id_unique
  ON wallet_transactions(source_click_id)
  WHERE source_click_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_user_pending_unique
  ON withdrawal_requests(user_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS amazon_gift_card_requests_user_pending_unique
  ON amazon_gift_card_requests(user_id)
  WHERE status = 'pending';
