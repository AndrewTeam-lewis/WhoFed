-- Change target_times from time[] to text[] to support encoded recurrence strings (e.g. "W:1:08:00")
ALTER TABLE public.schedules 
ALTER COLUMN target_times TYPE text[] 
USING target_times::text[];
