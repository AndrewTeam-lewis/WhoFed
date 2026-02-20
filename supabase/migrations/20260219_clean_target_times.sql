-- Clean up target_times to remove pipe-delimited labels (e.g. 08:00|Breakfast -> 08:00)
UPDATE public.schedules
SET target_times = (
    SELECT array_agg(split_part(elem, '|', 1))
    FROM unnest(target_times) AS elem
)
WHERE target_times IS NOT NULL;
