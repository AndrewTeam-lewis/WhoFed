-- ============================================================================
-- FIX PROFILES INDEXES AFTER USERNAME/PHONE/LASTNAME DROP
-- ============================================================================
-- The previous migration dropped username, phone, and last_name columns,
-- but the performance indexes migration tried to create an index on username.
-- This migration cleans up any broken indexes.
-- ============================================================================

-- Drop the username index if it exists (may have been created before column was dropped)
DROP INDEX IF EXISTS idx_profiles_username;

-- Ensure the email index still exists (this should work fine)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Profiles indexes fixed after column drop';
  RAISE NOTICE 'Removed: idx_profiles_username (column no longer exists)';
  RAISE NOTICE 'Verified: idx_profiles_email (still valid)';
END $$;
