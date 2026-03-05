-- =====================================================
-- Add user_id to influencers table
-- =====================================================
-- Links influencer records to LetsGo user accounts
-- so influencers can see their own dashboard on the profile page.
-- =====================================================

-- Add user_id column (nullable — not all influencers may have accounts yet)
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Index for fast lookup: "is this user an influencer?"
CREATE INDEX IF NOT EXISTS idx_influencers_user_id ON influencers(user_id);

-- Index for email-based fallback matching
CREATE INDEX IF NOT EXISTS idx_influencers_email ON influencers(email);
