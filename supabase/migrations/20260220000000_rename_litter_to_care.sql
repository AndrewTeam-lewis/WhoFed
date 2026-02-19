-- Rename task type "litter" to "care" for flexibility
-- Migration: 20260220000000_rename_litter_to_care

-- Update schedules table
UPDATE schedules
SET task_type = 'care'
WHERE task_type = 'litter';

-- Update daily_tasks table
UPDATE daily_tasks
SET task_type = 'care'
WHERE task_type = 'litter';

-- Update activity_log table (if it has task_type or action_type)
-- Note: activity_log doesn't have task_type column, so skip

-- Add comment
COMMENT ON TABLE schedules IS 'Task types: feeding, medication, care (generic care tasks like walks, litter, grooming)';
