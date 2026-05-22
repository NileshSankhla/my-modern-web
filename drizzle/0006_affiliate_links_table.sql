CREATE TABLE affiliate_links (
  id SERIAL PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  link_number INTEGER NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX affiliate_links_merchant_id_idx ON affiliate_links(merchant_id);
CREATE INDEX affiliate_links_merchant_link_number_idx ON affiliate_links(merchant_id, link_number);
