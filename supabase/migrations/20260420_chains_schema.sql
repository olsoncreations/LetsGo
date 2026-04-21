-- ============================================================
-- Chain / Multi-Location Business Schema
-- ============================================================
-- Creates the foundation for chain management:
--   1. chains table (corporate entity)
--   2. chain_link_requests table (location → chain approval flow)
--   3. Adds chain_id + store_number to business table
--   4. RLS policies for all new objects
-- ============================================================

-- ------------------------------------------------------------
-- 1. chains table
-- ------------------------------------------------------------
CREATE TABLE chains (
  id              text PRIMARY KEY,                    -- CHN-BRANDNAME-0
  brand_name      text NOT NULL,                       -- Display name ("Scooter's Coffee")
  chain_code      text NOT NULL UNIQUE,                -- Code businesses enter to request link (e.g. "SCOOTERS")
  status          text NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review','verified','active','suspended')),

  -- Structure
  franchise_model text NOT NULL DEFAULT 'corporate'
                    CHECK (franchise_model IN ('franchise','corporate','mixed')),
  location_count  integer NOT NULL DEFAULT 0,          -- Cached count of linked businesses

  -- Pricing (per location / month)
  pricing_tier    text NOT NULL DEFAULT 'local'
                    CHECK (pricing_tier IN ('local','regional','national','enterprise')),
  premium_rate_cents integer NOT NULL DEFAULT 40000,   -- $400.00 default (local tier)

  -- Corporate contact
  contact_name    text,
  contact_title   text,
  contact_email   text,
  contact_phone   text,

  -- Corporate billing
  billing_email   text,
  billing_address text,
  payment_method  text CHECK (payment_method IS NULL OR payment_method IN ('bank','card')),
  bank_name       text,
  routing_last4   text,
  account_last4   text,
  card_brand      text,
  card_last4      text,

  -- Advertising interests
  advertising_interests jsonb DEFAULT '[]'::jsonb,

  -- Notes / internal
  internal_notes  text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_chains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chains_updated_at
  BEFORE UPDATE ON chains
  FOR EACH ROW EXECUTE FUNCTION update_chains_updated_at();

-- Index for lookups by chain_code (already UNIQUE, but explicit)
CREATE INDEX idx_chains_status ON chains (status);

-- ------------------------------------------------------------
-- 2. chain_link_requests table
-- ------------------------------------------------------------
CREATE TABLE chain_link_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     text NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  chain_id        text NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  store_number    text NOT NULL,                       -- e.g. "147" (chain's internal numbering)
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','denied')),
  requested_by    uuid REFERENCES auth.users(id),      -- User who submitted the request
  requested_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_by     uuid REFERENCES auth.users(id),      -- Corporate user who reviewed
  reviewed_at     timestamptz,
  denial_reason   text,

  -- Prevent duplicate pending requests for same business+chain
  UNIQUE (business_id, chain_id)
);

CREATE INDEX idx_chain_link_requests_chain ON chain_link_requests (chain_id, status);
CREATE INDEX idx_chain_link_requests_business ON chain_link_requests (business_id);

-- ------------------------------------------------------------
-- 3. Add chain columns to business table
-- ------------------------------------------------------------
ALTER TABLE business
  ADD COLUMN chain_id      text REFERENCES chains(id),
  ADD COLUMN store_number  text;

CREATE INDEX idx_business_chain ON business (chain_id) WHERE chain_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. RLS policies
-- ------------------------------------------------------------

-- chains table
ALTER TABLE chains ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY chains_admin_all ON chains
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

-- Corporate users (owner/manager of CHN-BRAND-0): read their own chain
CREATE POLICY chains_corporate_read ON chains
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.user_id = auth.uid()
        AND bu.role IN ('owner','manager')
        AND bu.business_id = chains.id   -- CHN-BRAND-0 is both the chain id and the corporate "business" id
    )
  );

-- Any authenticated user can see active chains (for chain code lookup during linking)
CREATE POLICY chains_public_active ON chains
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- chain_link_requests table
ALTER TABLE chain_link_requests ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY chain_link_requests_admin_all ON chain_link_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE user_id = auth.uid())
  );

-- Corporate users: read + update requests for their chain
CREATE POLICY chain_link_requests_corporate ON chain_link_requests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.user_id = auth.uid()
        AND bu.role IN ('owner','manager')
        AND bu.business_id = chain_link_requests.chain_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.user_id = auth.uid()
        AND bu.role IN ('owner','manager')
        AND bu.business_id = chain_link_requests.chain_id
    )
  );

-- Business owners: can read their own link requests + insert new ones
CREATE POLICY chain_link_requests_business_read ON chain_link_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.user_id = auth.uid()
        AND bu.business_id = chain_link_requests.business_id
    )
  );

CREATE POLICY chain_link_requests_business_insert ON chain_link_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_users bu
      WHERE bu.user_id = auth.uid()
        AND bu.role = 'owner'
        AND bu.business_id = chain_link_requests.business_id
    )
  );
