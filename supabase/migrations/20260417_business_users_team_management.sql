-- Enable RLS on business_users (idempotent)
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (clean slate)
DROP POLICY IF EXISTS "Business members can read team" ON business_users;
DROP POLICY IF EXISTS "Staff full access to business_users" ON business_users;

-- 1. SELECT: Any member of a business can read all members of that business
CREATE POLICY "Business members can read team"
  ON business_users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM business_users my
      WHERE my.business_id = business_users.business_id
        AND my.user_id = auth.uid()
    )
  );

-- 2. Staff (admins) get full access for all operations
CREATE POLICY "Staff full access to business_users"
  ON business_users FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff_users WHERE staff_users.user_id = auth.uid())
  );
