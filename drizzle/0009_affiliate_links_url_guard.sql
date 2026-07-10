ALTER TABLE affiliate_links
  ADD CONSTRAINT affiliate_links_url_valid_amazon_tag
  CHECK (
    url ~* '^https://([^.]+\.)*amazon\.(in|com)([/?#].*)?[?&]tag=(fareback0c-21|fareback00[1-9]-21|fareback0[1-4][0-9]-21|fareback050-21)([&#]|$)'
  );