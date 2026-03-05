-- Migration: Create user_friends table for the social/friends system
-- Supports friend requests (pending/accepted/blocked) with RLS

CREATE TABLE IF NOT EXISTS user_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate friend pairs in the same direction
  CONSTRAINT uq_user_friends_pair UNIQUE (user_id, friend_id),
  -- Prevent self-friending
  CONSTRAINT chk_no_self_friend CHECK (user_id <> friend_id)
);

-- Indexes for efficient friend list lookups
CREATE INDEX idx_user_friends_user ON user_friends (user_id, status);
CREATE INDEX idx_user_friends_friend ON user_friends (friend_id, status);

-- Enable RLS
ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;

-- Users can see friend records where they are either party
CREATE POLICY "Users can view own friend records"
  ON user_friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create friend requests (they must be the requester)
CREATE POLICY "Users can send friend requests"
  ON user_friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update records where they are either party (accept/reject/block)
CREATE POLICY "Users can update own friend records"
  ON user_friends FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can delete their own sent requests or unfriend
CREATE POLICY "Users can delete own friend records"
  ON user_friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
