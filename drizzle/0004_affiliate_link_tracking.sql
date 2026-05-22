-- Add affiliate link tracking to clicks table
ALTER TABLE clicks ADD COLUMN affiliate_link_index INTEGER;
ALTER TABLE clicks ADD COLUMN affiliate_link_url TEXT;

-- Create index for efficient queries on affiliate link index
CREATE INDEX clicks_affiliate_link_index_idx ON clicks(affiliate_link_index);
