# Server-Side Task Generation System

## Overview

This system ensures that daily tasks are automatically generated for all households at midnight (in their respective timezones) without requiring any client to be online.

## How It Works

### Architecture
- **PostgreSQL Functions**: All task generation logic runs in the database
- **pg_cron**: Scheduled job runs every 5 minutes
- **Timezone-Aware**: Each household's midnight is determined by its `timezone` field
- **Idempotent**: Safe to run multiple times - won't create duplicates

### Components

1. **`household_task_processing` Table**
   - Tracks when each household was last processed
   - Stores `last_processed_date` to prevent duplicate runs

2. **`generate_tasks_for_household_date()`**
   - Generates tasks for a specific date
   - Handles all schedule modes: daily, weekly, monthly, custom
   - Converts household timezone to UTC for storage

3. **`ensure_daily_tasks_for_household()`**
   - Creates tasks for today if they don't exist
   - Deduplicates based on `schedule_id` and `due_at`
   - Returns count of tasks created

4. **`cleanup_old_tasks_for_household()`**
   - Removes pending tasks before today
   - Preserves medication tasks (they persist until completed)
   - Returns count of tasks deleted

5. **`process_household_daily_tasks()`**
   - Main function called by cron
   - Checks all households
   - Processes those that have crossed midnight
   - Updates tracking table

6. **Cron Job: `process-household-daily-tasks`**
   - Runs every 5 minutes: `*/5 * * * *`
   - Calls `process_household_daily_tasks()`

## Deployment

### Apply Migration

```bash
# Development
npx supabase db push

# Production (via Supabase Dashboard)
# 1. Go to SQL Editor
# 2. Paste migration content
# 3. Run
```

### Verify Installation

```sql
-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'process-household-daily-tasks';

-- Check if functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%household%task%';

-- Check tracking table
SELECT * FROM public.household_task_processing;
```

## Monitoring

### Check Processing Status

```sql
-- See when each household was last processed
SELECT
    h.name as household_name,
    h.timezone,
    htp.last_processed_at,
    htp.last_processed_date,
    (NOW() AT TIME ZONE h.timezone)::DATE as current_date_in_tz
FROM households h
LEFT JOIN household_task_processing htp ON h.id = htp.household_id
ORDER BY htp.last_processed_at DESC NULLS LAST;
```

### View Cron Job History

```sql
-- Check recent cron executions
SELECT * FROM cron.job_run_details
WHERE jobname = 'process-household-daily-tasks'
ORDER BY start_time DESC
LIMIT 10;
```

### Manually Trigger Processing

```sql
-- Run processing immediately (for testing)
SELECT * FROM public.process_household_daily_tasks();
```

### Check Generated Tasks

```sql
-- See tasks created today for a specific household
SELECT
    dt.id,
    p.name as pet_name,
    dt.label,
    dt.task_type,
    dt.due_at,
    dt.status,
    dt.created_at
FROM daily_tasks dt
JOIN pets p ON dt.pet_id = p.id
WHERE dt.household_id = 'YOUR_HOUSEHOLD_ID'
  AND dt.created_at > NOW() - INTERVAL '24 hours'
ORDER BY dt.due_at;
```

## Testing

### Test Scenario 1: New Household
```sql
-- 1. Create a test household
INSERT INTO households (id, name, owner_id, timezone)
VALUES (
    gen_random_uuid(),
    'Test Household',
    'YOUR_USER_ID',
    'America/New_York'
);

-- 2. Wait up to 5 minutes for cron to run, or trigger manually
SELECT * FROM public.process_household_daily_tasks();

-- 3. Verify tracking record created
SELECT * FROM household_task_processing WHERE household_id = 'TEST_HOUSEHOLD_ID';
```

### Test Scenario 2: Timezone Change
```sql
-- 1. Change household timezone
UPDATE households
SET timezone = 'America/Los_Angeles'
WHERE id = 'YOUR_HOUSEHOLD_ID';

-- 2. Trigger processing
SELECT * FROM public.process_household_daily_tasks();

-- 3. Verify tasks generated in new timezone
```

### Test Scenario 3: Multiple Runs (Idempotency)
```sql
-- Run multiple times - should not create duplicates
SELECT * FROM public.process_household_daily_tasks();
SELECT * FROM public.process_household_daily_tasks();
SELECT * FROM public.process_household_daily_tasks();

-- Verify no duplicate tasks
SELECT schedule_id, due_at, COUNT(*)
FROM daily_tasks
WHERE household_id = 'YOUR_HOUSEHOLD_ID'
GROUP BY schedule_id, due_at
HAVING COUNT(*) > 1;
-- Should return no rows
```

## Troubleshooting

### Tasks Not Generating

**Check 1: Is cron running?**
```sql
SELECT * FROM cron.job WHERE jobname = 'process-household-daily-tasks';
-- Should show: schedule = '*/5 * * * *', active = true
```

**Check 2: Are there errors?**
```sql
SELECT * FROM cron.job_run_details
WHERE jobname = 'process-household-daily-tasks'
ORDER BY start_time DESC LIMIT 5;
-- Check status and return_message columns
```

**Check 3: Is household being processed?**
```sql
SELECT * FROM household_task_processing WHERE household_id = 'YOUR_HOUSEHOLD_ID';
-- Should update every midnight in household timezone
```

**Check 4: Are schedules enabled?**
```sql
SELECT s.*, p.name as pet_name
FROM schedules s
JOIN pets p ON s.pet_id = p.id
WHERE p.household_id = 'YOUR_HOUSEHOLD_ID'
AND s.is_enabled = false;
-- These won't generate tasks
```

### Cron Not Running

```sql
-- Reschedule cron job
SELECT cron.unschedule('process-household-daily-tasks');
SELECT cron.schedule(
    'process-household-daily-tasks',
    '*/5 * * * *',
    $$SELECT public.process_household_daily_tasks()$$
);
```

### Performance Issues

```sql
-- Check how long processing takes
SELECT
    start_time,
    end_time,
    end_time - start_time as duration,
    return_message
FROM cron.job_run_details
WHERE jobname = 'process-household-daily-tasks'
ORDER BY start_time DESC
LIMIT 10;
```

## Client-Side Behavior

### Keeping Client Calls as Backup
The client-side calls in `+layout.svelte` and `app/+page.svelte` are kept as a backup:
- They still run when users open the app
- Server-side generation happens first at midnight
- Client-side ensures tasks exist even if server fails
- Deduplication logic prevents duplicates

### Removing Client-Side Calls (Optional)
If you want to rely 100% on server-side:
1. Remove `ensureDailyTasks()` calls from `+layout.svelte`
2. Remove midnight timer logic from `app/+page.svelte`
3. Keep `cleanupOldTasks()` for immediate cleanup on app open

## Rollback

To completely remove this system:

```sql
-- Unschedule cron job
SELECT cron.unschedule('process-household-daily-tasks');

-- Drop functions
DROP FUNCTION IF EXISTS public.process_household_daily_tasks();
DROP FUNCTION IF EXISTS public.cleanup_old_tasks_for_household(UUID, TEXT);
DROP FUNCTION IF EXISTS public.ensure_daily_tasks_for_household(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_tasks_for_household_date(UUID, DATE, TEXT);

-- Drop table
DROP TABLE IF EXISTS public.household_task_processing;
```

## Success Metrics

✅ **Working correctly when:**
- Each household's `last_processed_date` updates daily at their midnight
- Tasks appear automatically without any client opening the app
- No duplicate tasks are created
- Cron job runs successfully every 5 minutes
- Processing completes in < 10 seconds for all households

## Notes

- **Max 5-minute delay**: Tasks generated within 5 minutes after midnight
- **No client dependency**: Works even if all users are offline
- **Timezone accurate**: Respects each household's timezone setting
- **Idempotent**: Safe to call multiple times
- **Preserves medications**: Medication tasks persist until completed
