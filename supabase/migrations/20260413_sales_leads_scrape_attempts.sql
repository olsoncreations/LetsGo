-- Track how many times we've attempted to scrape an email from a lead's website
ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS scrape_attempts INTEGER NOT NULL DEFAULT 0;
