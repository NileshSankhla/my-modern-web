-- Create affiliate link counter table for managing rotation across concurrent requests
CREATE TABLE affiliate_link_counter (
  id SERIAL PRIMARY KEY,
  link_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert initial counter record
INSERT INTO affiliate_link_counter (id, link_count, updated_at) 
VALUES (1, 0, NOW())
ON CONFLICT DO NOTHING;
