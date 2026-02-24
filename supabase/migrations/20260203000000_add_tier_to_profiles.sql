-- Add user-level tier column to profiles table
-- Replaces household-level subscription_status as the source of truth for premium gating
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free';

-- Backfill: migrate existing premium household owners to premium user tier
UPDATE profiles
SET tier = 'premium'
WHERE id IN (
    SELECT owner_id FROM households WHERE subscription_status = 'active'
);
