-- ============================================================================
-- PERFORMANCE INDEXES MIGRATION
-- ============================================================================
-- This migration adds critical indexes to improve query performance across
-- all tables. Currently the app relies only on primary key indexes, causing
-- full table scans on common operations like login, dashboard loading, and
-- task generation.
--
-- Priority: CRITICAL - Fixes slow dashboard loading and login performance
-- Expected Impact: Dashboard load time reduced from minutes to <1 second
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Used for: Authentication, user lookup, username availability checks
-- Current State: No indexes except primary key

-- CRITICAL: Used in every login flow and username availability checks
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- HIGH: Used in auth flows for password reset and registration
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);


-- ============================================================================
-- HOUSEHOLDS TABLE
-- ============================================================================
-- Used for: Household ownership checks, RLS policies
-- Current State: Primary key only

-- HIGH: Used in RLS policies and to find households owned by a user
CREATE INDEX IF NOT EXISTS idx_households_owner_id ON households(owner_id);


-- ============================================================================
-- HOUSEHOLD_MEMBERS TABLE (PRIMARY BOTTLENECK)
-- ============================================================================
-- Used for: Membership checks, app initialization, household switching
-- Current State: Composite primary key (household_id, user_id)
-- Impact: This table's lack of indexes is causing the reported
--         "minutes to load" issue on dashboard

-- CRITICAL: Find all households a user belongs to (app initialization)
-- This is THE KEY INDEX that fixes the slow dashboard loading
-- Query: .eq('user_id', userId) in loadHouseholds()
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);

-- HIGH: Composite index for RLS policies checking active membership
CREATE INDEX IF NOT EXISTS idx_household_members_household_id_is_active
ON household_members(household_id, is_active);


-- ============================================================================
-- HOUSEHOLD_KEYS TABLE
-- ============================================================================
-- Used for: Join household flow via QR code/link
-- Current State: Primary key only

-- MEDIUM: Used to look up household by key_value for join flow
CREATE INDEX IF NOT EXISTS idx_household_keys_household_id ON household_keys(household_id);

-- HIGH: Used to validate and look up keys (unique key lookups)
CREATE INDEX IF NOT EXISTS idx_household_keys_key_value ON household_keys(key_value);


-- ============================================================================
-- PETS TABLE
-- ============================================================================
-- Used for: Dashboard loading, pet listing per household
-- Current State: Primary key only

-- CRITICAL: Used on every dashboard load to fetch all pets in household
-- Query: .eq('household_id', householdId) in fetchDashboardData()
CREATE INDEX IF NOT EXISTS idx_pets_household_id ON pets(household_id);


-- ============================================================================
-- SCHEDULES TABLE
-- ============================================================================
-- Used for: Task generation, pet settings, schedule management
-- Current State: Primary key only

-- CRITICAL: Used to fetch schedules for a pet (task generation & settings)
-- Query: .in('pet_id', petIds) in ensureDailyTasks()
CREATE INDEX IF NOT EXISTS idx_schedules_pet_id ON schedules(pet_id);

-- HIGH: Composite index for task generation query pattern
-- Query: .eq('is_enabled', true).in('pet_id', petIds)
CREATE INDEX IF NOT EXISTS idx_schedules_pet_id_is_enabled
ON schedules(pet_id, is_enabled);


-- ============================================================================
-- DAILY_TASKS TABLE (HIGHEST FREQUENCY QUERIES)
-- ============================================================================
-- Used for: Dashboard, task completion, task generation
-- Current State: Primary key only
-- Impact: This is the MOST QUERIED table in the app

-- CRITICAL: Dashboard query pattern - used on every page load
-- Query: .eq('household_id', id).gte('due_at', start).lte('due_at', end)
CREATE INDEX IF NOT EXISTS idx_daily_tasks_household_id_due_at
ON daily_tasks(household_id, due_at);

-- HIGH: Bulk queries with .in('pet_id', [...])
CREATE INDEX IF NOT EXISTS idx_daily_tasks_pet_id ON daily_tasks(pet_id);

-- MEDIUM: Filter by task status (pending/completed)
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON daily_tasks(status);

-- MEDIUM: Combined household + status filtering
CREATE INDEX IF NOT EXISTS idx_daily_tasks_household_id_status
ON daily_tasks(household_id, status);


-- ============================================================================
-- ACTIVITY_LOG TABLE
-- ============================================================================
-- Used for: Activity history, recent activity display, audit trails
-- Current State: Primary key only

-- HIGH: Fetch activity for pets (dashboard recent activity)
-- Query: .in('pet_id', pets.map(p => p.id))
CREATE INDEX IF NOT EXISTS idx_activity_log_pet_id ON activity_log(pet_id);

-- MEDIUM: RLS policies and audit queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

-- HIGH: Most common query pattern - recent activity for pet ordered by date
-- Query: .in('pet_id', [...]).order('performed_at', { ascending: false })
-- DESC ordering optimizes "latest first" queries
CREATE INDEX IF NOT EXISTS idx_activity_log_pet_id_performed_at
ON activity_log(pet_id, performed_at DESC);


-- ============================================================================
-- HOUSEHOLD_INVITATIONS TABLE
-- ============================================================================
-- Used for: Invite management, notification flows
-- Current State: Primary key only

-- HIGH: Find pending invites for a user
-- Query: .eq('invited_user_id', id).eq('status', 'pending')
CREATE INDEX IF NOT EXISTS idx_household_invitations_invited_user_id_status
ON household_invitations(invited_user_id, status);

-- MEDIUM: Household owners managing invites
CREATE INDEX IF NOT EXISTS idx_household_invitations_household_id_status
ON household_invitations(household_id, status);


-- ============================================================================
-- REMINDER_SETTINGS TABLE
-- ============================================================================
-- Used for: Notification sending, reminder management
-- Current State: Composite primary key (user_id, schedule_id)

-- MEDIUM: Bulk notification queries (find all users for a schedule)
-- Used in scheduled notification jobs
CREATE INDEX IF NOT EXISTS idx_reminder_settings_schedule_id
ON reminder_settings(schedule_id);


-- ============================================================================
-- VERIFICATION & MONITORING
-- ============================================================================
-- After running this migration, you can verify indexes were created with:
--
--   SELECT tablename, indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY tablename, indexname;
--
-- Monitor index usage over time with:
--
--   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
--   FROM pg_stat_user_indexes
--   WHERE schemaname = 'public'
--   ORDER BY idx_scan DESC;
--
-- ============================================================================

-- Log successful completion
DO $$
BEGIN
  RAISE NOTICE 'Performance indexes migration completed successfully';
  RAISE NOTICE 'Total indexes added: 20';
  RAISE NOTICE 'Expected impact: Dashboard load time < 1 second';
END $$;
