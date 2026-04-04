-- Allow public (unauthenticated) role applications from /careers pages
-- 1. Make user_id nullable for guest applicants
-- 2. Drop the old unique index (required user_id) and create a new one using email

ALTER TABLE role_applications
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop old unique index that required user_id
DROP INDEX IF EXISTS uq_role_applications_pending;

-- New unique index: one pending application per email per type
CREATE UNIQUE INDEX uq_role_applications_pending_email
  ON role_applications (email, application_type) WHERE status = 'submitted';

-- Keep the user_id-based uniqueness for authenticated submissions
CREATE UNIQUE INDEX uq_role_applications_pending_user
  ON role_applications (user_id, application_type) WHERE status = 'submitted' AND user_id IS NOT NULL;
