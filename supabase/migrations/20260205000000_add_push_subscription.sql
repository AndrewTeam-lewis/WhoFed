-- Add push_subscription column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_subscription jsonb;
