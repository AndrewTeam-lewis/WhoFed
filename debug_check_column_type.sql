-- Run this to see what type the column 'target_times' actually is
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'schedules' AND column_name = 'target_times';

-- If 'udt_name' says '_time' (which means time[]), that is the problem.
-- It needs to be '_text' (text[]).
