-- Migration: Unified Influencer + Receipt Payout System
-- Connects influencer earnings to the existing user cashout flow (profiles.available_balance → user_payouts → PayPal/Venmo)

-- 1. Add breakdown JSONB to user_payouts
--    Stores itemized sources at cashout time (influencer earnings vs receipt cashback)
ALTER TABLE user_payouts ADD COLUMN IF NOT EXISTS breakdown JSONB;

-- 2. Add credited_to_balance flag on influencer_payouts
--    Tracks whether the payout amount was credited to profiles.available_balance
ALTER TABLE influencer_payouts ADD COLUMN IF NOT EXISTS credited_to_balance BOOLEAN DEFAULT false;
