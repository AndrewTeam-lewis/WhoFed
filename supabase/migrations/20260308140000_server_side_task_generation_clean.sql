-- Server-Side Task Generation System (Clean Install)
-- This migration creates a fully automated server-side task generation system
-- that runs every 5 minutes and processes tasks for each household at midnight in their timezone.

-- ============================================================================
-- 0. CLEANUP EXISTING OBJECTS (if any)
-- ============================================================================

-- Drop existing cron job if it exists
SELECT cron.unschedule('process-household-daily-tasks') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'process-household-daily-tasks'
);

-- Drop existing functions (cascade to remove dependencies)
DROP FUNCTION IF EXISTS public.process_household_daily_tasks();
DROP FUNCTION IF EXISTS public.cleanup_old_tasks_for_household(UUID, TEXT);
DROP FUNCTION IF EXISTS public.ensure_daily_tasks_for_household(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_tasks_for_household_date(UUID, DATE, TEXT);

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view task processing for their households" ON public.household_task_processing;
DROP POLICY IF EXISTS "Service role can manage task processing" ON public.household_task_processing;

-- Drop existing table (will recreate)
DROP TABLE IF EXISTS public.household_task_processing;

-- ============================================================================
-- 1. CREATE TRACKING TABLE
-- ============================================================================
-- Tracks when each household last had tasks processed to prevent duplicates

CREATE TABLE public.household_task_processing (
    household_id UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
    last_processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_processed_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.household_task_processing ENABLE ROW LEVEL SECURITY;

-- Allow users to view processing status for their households
CREATE POLICY "Users can view task processing for their households"
    ON public.household_task_processing
    FOR SELECT
    TO authenticated
    USING (
        household_id IN (
            SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
        )
    );

-- Only service role can insert/update
CREATE POLICY "Service role can manage task processing"
    ON public.household_task_processing
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_household_task_processing_date
    ON public.household_task_processing(last_processed_date);

-- ============================================================================
-- 2. HELPER FUNCTION: Generate tasks for a specific date
-- ============================================================================
-- This replicates the logic from taskUtils.ts generateTasksForDate()

CREATE FUNCTION public.generate_tasks_for_household_date(
    p_household_id UUID,
    p_date DATE,
    p_timezone TEXT
)
RETURNS TABLE(
    schedule_id UUID,
    pet_id UUID,
    label TEXT,
    task_type TEXT,
    due_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schedule RECORD;
    v_target_time TEXT;
    v_local_datetime TIMESTAMP;
    v_utc_datetime TIMESTAMPTZ;
    v_day_of_week INT;
    v_day_of_month INT;
    v_schedule_parts TEXT[];
BEGIN
    -- Get day of week (0=Sunday) and day of month
    v_day_of_week := EXTRACT(DOW FROM p_date);
    v_day_of_month := EXTRACT(DAY FROM p_date);

    -- Loop through all enabled schedules for pets in this household
    FOR v_schedule IN
        SELECT
            s.id as schedule_id,
            s.pet_id,
            s.label,
            s.task_type,
            s.schedule_mode,
            s.target_times
        FROM public.schedules s
        JOIN public.pets p ON s.pet_id = p.id
        WHERE p.household_id = p_household_id
          AND s.is_enabled = true
    LOOP
        -- Process each target time in the schedule
        FOR v_target_time IN
            SELECT unnest(v_schedule.target_times)
        LOOP
            -- Parse schedule mode and check if it applies to this date
            v_schedule_parts := string_to_array(v_target_time, ':');

            -- Daily mode: HH:MM
            IF v_schedule.schedule_mode = 'daily' AND array_length(v_schedule_parts, 1) = 2 THEN
                -- Construct local datetime
                v_local_datetime := p_date + (v_target_time || ':00')::TIME;
                -- Convert to UTC
                v_utc_datetime := timezone(p_timezone, v_local_datetime);

                RETURN QUERY SELECT
                    v_schedule.schedule_id AS schedule_id,
                    v_schedule.pet_id AS pet_id,
                    v_schedule.label AS label,
                    v_schedule.task_type AS task_type,
                    v_utc_datetime AS due_at;

            -- Weekly mode: W:Day:HH:MM (0=Sunday)
            ELSIF v_schedule.schedule_mode = 'weekly' AND array_length(v_schedule_parts, 1) = 4
                  AND v_schedule_parts[1] = 'W' THEN
                IF v_schedule_parts[2]::INT = v_day_of_week THEN
                    v_local_datetime := p_date + (v_schedule_parts[3] || ':' || v_schedule_parts[4] || ':00')::TIME;
                    v_utc_datetime := timezone(p_timezone, v_local_datetime);

                    RETURN QUERY SELECT
                        v_schedule.schedule_id AS schedule_id,
                        v_schedule.pet_id AS pet_id,
                        v_schedule.label AS label,
                        v_schedule.task_type AS task_type,
                        v_utc_datetime AS due_at;
                END IF;

            -- Monthly mode: M:Day:HH:MM (1-31)
            ELSIF v_schedule.schedule_mode = 'monthly' AND array_length(v_schedule_parts, 1) = 4
                  AND v_schedule_parts[1] = 'M' THEN
                IF v_schedule_parts[2]::INT = v_day_of_month THEN
                    v_local_datetime := p_date + (v_schedule_parts[3] || ':' || v_schedule_parts[4] || ':00')::TIME;
                    v_utc_datetime := timezone(p_timezone, v_local_datetime);

                    RETURN QUERY SELECT
                        v_schedule.schedule_id AS schedule_id,
                        v_schedule.pet_id AS pet_id,
                        v_schedule.label AS label,
                        v_schedule.task_type AS task_type,
                        v_utc_datetime AS due_at;
                END IF;

            -- Custom mode: C:YYYY-MM-DD:HH:MM
            ELSIF v_schedule.schedule_mode = 'custom' AND array_length(v_schedule_parts, 1) = 5
                  AND v_schedule_parts[1] = 'C' THEN
                IF v_schedule_parts[2]::DATE = p_date THEN
                    v_local_datetime := p_date + (v_schedule_parts[3] || ':' || v_schedule_parts[4] || ':00')::TIME;
                    v_utc_datetime := timezone(p_timezone, v_local_datetime);

                    RETURN QUERY SELECT
                        v_schedule.schedule_id AS schedule_id,
                        v_schedule.pet_id AS pet_id,
                        v_schedule.label AS label,
                        v_schedule.task_type AS task_type,
                        v_utc_datetime AS due_at;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- ============================================================================
-- 3. FUNCTION: Ensure daily tasks for a household
-- ============================================================================
-- Generates tasks for today if they don't already exist

CREATE FUNCTION public.ensure_daily_tasks_for_household(
    p_household_id UUID,
    p_timezone TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_local DATE;
    v_start_of_day TIMESTAMPTZ;
    v_end_of_day TIMESTAMPTZ;
    v_tasks_inserted INT := 0;
BEGIN
    -- Calculate today in household timezone
    v_today_local := (NOW() AT TIME ZONE p_timezone)::DATE;
    v_start_of_day := timezone(p_timezone, v_today_local::TIMESTAMP);
    v_end_of_day := timezone(p_timezone, (v_today_local + INTERVAL '1 day')::TIMESTAMP);

    -- Insert new tasks that don't already exist
    INSERT INTO public.daily_tasks (
        household_id,
        pet_id,
        schedule_id,
        label,
        task_type,
        due_at,
        status
    )
    SELECT
        p_household_id,
        gt.pet_id,
        gt.schedule_id,
        gt.label,
        gt.task_type,
        gt.due_at,
        'pending'
    FROM public.generate_tasks_for_household_date(p_household_id, v_today_local, p_timezone) gt
    WHERE NOT EXISTS (
        -- Prevent duplicates: same schedule and due_at
        SELECT 1 FROM public.daily_tasks dt
        WHERE dt.schedule_id = gt.schedule_id
          AND dt.due_at = gt.due_at
          AND dt.household_id = p_household_id
    );

    GET DIAGNOSTICS v_tasks_inserted = ROW_COUNT;

    RETURN v_tasks_inserted;
END;
$$;

-- ============================================================================
-- 4. FUNCTION: Cleanup old tasks for a household
-- ============================================================================
-- Removes pending tasks that are overdue (except medications)

CREATE FUNCTION public.cleanup_old_tasks_for_household(
    p_household_id UUID,
    p_timezone TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_local DATE;
    v_start_of_today TIMESTAMPTZ;
    v_tasks_deleted INT := 0;
BEGIN
    -- Calculate start of today in household timezone
    v_today_local := (NOW() AT TIME ZONE p_timezone)::DATE;
    v_start_of_today := timezone(p_timezone, v_today_local::TIMESTAMP);

    -- Delete old pending tasks (not medications, which persist)
    -- All column references are explicitly qualified to avoid ambiguity
    DELETE FROM public.daily_tasks
    WHERE daily_tasks.household_id = p_household_id
      AND daily_tasks.status = 'pending'
      AND daily_tasks.due_at < v_start_of_today
      AND daily_tasks.task_type != 'medication';

    GET DIAGNOSTICS v_tasks_deleted = ROW_COUNT;

    RETURN v_tasks_deleted;
END;
$$;

-- ============================================================================
-- 5. MAIN PROCESSING FUNCTION
-- ============================================================================
-- Processes all households that have crossed midnight since last check

CREATE FUNCTION public.process_household_daily_tasks()
RETURNS TABLE(
    ret_household_id UUID,
    ret_household_name TEXT,
    ret_timezone TEXT,
    ret_tasks_created INT,
    ret_tasks_deleted INT,
    ret_processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_household RECORD;
    v_current_date_local DATE;
    v_last_processed_date DATE;
    v_tasks_created INT;
    v_tasks_deleted INT;
BEGIN
    -- Loop through all households
    FOR v_household IN
        SELECT h.id, h.name, h.timezone
        FROM public.households h
    LOOP
        -- Calculate current date in household's timezone
        v_current_date_local := (NOW() AT TIME ZONE v_household.timezone)::DATE;

        -- Get last processed date for this household
        SELECT htp.last_processed_date INTO v_last_processed_date
        FROM public.household_task_processing htp
        WHERE htp.household_id = v_household.id;

        -- Process if:
        -- 1. Never processed before (NULL), OR
        -- 2. Current date in household timezone is different from last processed date
        IF v_last_processed_date IS NULL OR v_last_processed_date != v_current_date_local THEN
            -- Run cleanup
            SELECT public.cleanup_old_tasks_for_household(
                v_household.id,
                v_household.timezone
            ) INTO v_tasks_deleted;

            -- Generate new tasks
            SELECT public.ensure_daily_tasks_for_household(
                v_household.id,
                v_household.timezone
            ) INTO v_tasks_created;

            -- Update or insert tracking record
            INSERT INTO public.household_task_processing (
                household_id,
                last_processed_at,
                last_processed_date,
                updated_at
            ) VALUES (
                v_household.id,
                NOW(),
                v_current_date_local,
                NOW()
            )
            ON CONFLICT (household_id) DO UPDATE
            SET last_processed_at = NOW(),
                last_processed_date = v_current_date_local,
                updated_at = NOW();

            -- Return result for this household
            RETURN QUERY SELECT
                v_household.id,
                v_household.name,
                v_household.timezone,
                v_tasks_created,
                v_tasks_deleted,
                NOW();
        END IF;
    END LOOP;
END;
$$;

-- ============================================================================
-- 6. SET UP CRON JOB
-- ============================================================================
-- Schedule the processing function to run every 5 minutes

SELECT cron.schedule(
    'process-household-daily-tasks',  -- Job name
    '*/5 * * * *',                     -- Every 5 minutes
    $$SELECT public.process_household_daily_tasks()$$
);

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION public.generate_tasks_for_household_date TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_daily_tasks_for_household TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_tasks_for_household TO service_role;
GRANT EXECUTE ON FUNCTION public.process_household_daily_tasks TO service_role;

-- ============================================================================
-- 8. INITIAL RUN
-- ============================================================================
-- Run once immediately to process any households that need it

SELECT public.process_household_daily_tasks();

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To remove this system, run:
-- SELECT cron.unschedule('process-household-daily-tasks');
-- DROP FUNCTION IF EXISTS public.process_household_daily_tasks();
-- DROP FUNCTION IF EXISTS public.cleanup_old_tasks_for_household(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.ensure_daily_tasks_for_household(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.generate_tasks_for_household_date(UUID, DATE, TEXT);
-- DROP TABLE IF EXISTS public.household_task_processing;
