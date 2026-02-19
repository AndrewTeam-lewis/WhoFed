-- Critical performance indexes for scale
-- Migration: 20260219000000_add_critical_indexes

-- 1. CRITICAL: Cron job filtering (runs every minute across all schedules)
-- Without this, cron scans all schedules even disabled ones
CREATE INDEX IF NOT EXISTS idx_schedules_is_enabled ON schedules(is_enabled);

-- 2. HIGH: Invitation queries by inviter (settings page "sent invitations")
-- Currently missing, causes slow profile join
CREATE INDEX IF NOT EXISTS idx_household_invitations_invited_by ON household_invitations(invited_by);

-- 3. HIGH: Composite for status filtering on dashboard
-- Optimizes: .eq('status', 'pending').gte('due_at', ...)
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status_due_at ON daily_tasks(status, due_at);

-- 4. MEDIUM: Cleanup operations on old completed tasks
-- Used in: cleanupOldTasks() service
CREATE INDEX IF NOT EXISTS idx_daily_tasks_completed_at ON daily_tasks(completed_at) WHERE completed_at IS NOT NULL;

-- 5. MEDIUM: Active member filtering in RLS policies
-- Speeds up: WHERE is_active = true checks
CREATE INDEX IF NOT EXISTS idx_household_members_is_active ON household_members(is_active);

-- 6. MEDIUM: Reminder settings default behavior
-- Used in: Cron job LEFT JOIN for user notification preferences
CREATE INDEX IF NOT EXISTS idx_reminder_settings_is_enabled ON reminder_settings(is_enabled);

-- 7. LOW: Premium user queries (future feature gating)
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);

-- 8. LOW: Subscription status filtering (analytics/admin queries)
CREATE INDEX IF NOT EXISTS idx_households_subscription_status ON households(subscription_status);

-- 9. CRITICAL: One-time task cron optimization (runs every minute)
-- Composite for: WHERE schedule_id IS NULL AND status != 'completed' AND due_at BETWEEN ...
CREATE INDEX IF NOT EXISTS idx_daily_tasks_schedule_id_status_due_at ON daily_tasks(schedule_id, status, due_at) WHERE schedule_id IS NULL;

-- 10. CRITICAL: Cron job LEFT JOIN optimization on reminder_settings
-- Composite for: LEFT JOIN reminder_settings rs ON rs.schedule_id = s.id AND rs.user_id = hm.user_id
CREATE INDEX IF NOT EXISTS idx_reminder_settings_schedule_id_user_id ON reminder_settings(schedule_id, user_id, is_enabled);

-- 11. HIGH: Dashboard medication filter (dashboard displays past medications separately)
-- Composite for: .eq('household_id', id).eq('task_type', 'medication').neq('status', 'completed')
CREATE INDEX IF NOT EXISTS idx_daily_tasks_household_id_task_type ON daily_tasks(household_id, task_type, status);

-- 12. MEDIUM: Activity log cleanup (unlinking from deleted tasks)
-- For: UPDATE activity_log SET task_id = NULL WHERE task_id = ?
CREATE INDEX IF NOT EXISTS idx_activity_log_task_id ON activity_log(task_id) WHERE task_id IS NOT NULL;

-- 13. MEDIUM: Cron job push notification filtering
-- Partial index for: WHERE pr.push_subscription IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_profiles_push_subscription_notnull ON profiles(id) WHERE push_subscription IS NOT NULL;

-- Add comments explaining impact
COMMENT ON INDEX idx_schedules_is_enabled IS 'Critical: Cron job scans all schedules every minute - reduces scan from O(n) to O(n_enabled)';
COMMENT ON INDEX idx_household_invitations_invited_by IS 'High: Settings page "sent invitations" query joins on this FK';
COMMENT ON INDEX idx_daily_tasks_status_due_at IS 'High: Dashboard queries filter by both status and due_at range';
COMMENT ON INDEX idx_daily_tasks_schedule_id_status_due_at IS 'Critical: Cron one-time task notifications - filters by schedule_id IS NULL + status + due_at range';
COMMENT ON INDEX idx_reminder_settings_schedule_id_user_id IS 'Critical: Cron job LEFT JOIN optimization on reminder_settings';
COMMENT ON INDEX idx_daily_tasks_household_id_task_type IS 'High: Dashboard past medications query filters by household + task_type';
COMMENT ON INDEX idx_activity_log_task_id IS 'Medium: Activity log cleanup when tasks are deleted';
COMMENT ON INDEX idx_profiles_push_subscription_notnull IS 'Medium: Cron job filters to users with push enabled';
