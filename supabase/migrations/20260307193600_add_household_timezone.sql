-- ============================================================================
-- Add timezone column to households table
-- ============================================================================

-- 1. Add the column with a default
ALTER TABLE public.households 
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- 2. Migrate existing data: For each household, find any pet and grab its timezone.
-- If no pets exist, it simply keeps the default 'America/New_York'.
UPDATE public.households h
SET timezone = COALESCE(
    (SELECT p.pet_timezone 
     FROM public.pets p 
     WHERE p.household_id = h.id 
     LIMIT 1),
    'America/New_York'
);

-- ============================================================================
-- Note: pet_timezone on the pets table is now deprecated but being kept for 
-- backwards compatibility during the migration phase. It will be removed later.
-- ============================================================================
