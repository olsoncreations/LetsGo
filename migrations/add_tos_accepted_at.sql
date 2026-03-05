-- Add Terms of Service acceptance timestamp to profiles table
-- Records when the user agreed to the Terms of Service and Privacy Policy during signup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz DEFAULT NULL;

-- Optional: Add index for querying users who haven't accepted yet
CREATE INDEX IF NOT EXISTS idx_profiles_tos_accepted ON profiles (tos_accepted_at) WHERE tos_accepted_at IS NULL;
