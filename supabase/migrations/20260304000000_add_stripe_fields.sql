-- Add Stripe-related fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Create index for faster Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
ON profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Create index for Stripe subscription lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription
ON profiles(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;
