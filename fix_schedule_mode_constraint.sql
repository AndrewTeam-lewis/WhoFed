-- Recreate the schedule_mode check constraint to explicitly allow the values used by the app.
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.schedules
DROP CONSTRAINT IF EXISTS schedules_schedule_mode_check;

ALTER TABLE public.schedules
ADD CONSTRAINT schedules_schedule_mode_check
CHECK (schedule_mode IN ('daily', 'weekly', 'monthly', 'custom'));
