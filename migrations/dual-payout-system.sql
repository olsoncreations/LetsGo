-- Migration: Dual Payout System (Venmo + Bank via Stripe Connect)
-- Adds Stripe Connect fields to profiles and fee tracking to user_payouts

-- 1. Add Stripe Connect columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE;

-- 2. Add fee tracking and Stripe transfer ID to user_payouts
ALTER TABLE user_payouts ADD COLUMN IF NOT EXISTS fee_cents INTEGER DEFAULT 0;
ALTER TABLE user_payouts ADD COLUMN IF NOT EXISTS net_amount_cents INTEGER DEFAULT NULL;
ALTER TABLE user_payouts ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT DEFAULT NULL;
