-- Enable required extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Function to check schedules and match against current time in pet's timezone
create or replace function public.match_schedules_and_notify()
returns void
language plpgsql
security definer
as $$
declare
    v_schedule record;
    v_now_time text;
    v_pet_tz text;
    v_net_id uuid;
    v_func_url text := 'https://ryrwlkbzyldzbscvcqjh.supabase.co/functions/v1/send-push'; -- Replace with your project URL if different
    v_service_key text := 'YOUR_SERVICE_ROLE_KEY'; -- Ideally retrieved from a vault, but hardcoded for MVP migration (or use anon if configured)
begin
    -- 1. Loop through all active schedules joined with pets
    for v_schedule in
        select 
            s.id as schedule_id,
            s.label,
            s.task_type,
            s.target_times,
            p.pet_timezone,
            p.name as pet_name,
            hm.user_id,
            pr.push_subscription
        from schedules s
        join pets p on s.pet_id = p.id
        join household_members hm on p.household_id = hm.household_id
        join profiles pr on hm.user_id = pr.id
        left join reminder_settings rs on rs.schedule_id = s.id and rs.user_id = hm.user_id
        where 
            s.is_enabled = true
            and (rs.is_enabled is true or rs.is_enabled is null) -- Default to true if no setting
            and pr.push_subscription is not null -- User must have a sub
    loop
        -- 2. Calculate current time in the PET'S timezone
        -- Format: 'HH24:MI' e.g. '08:00'
        v_pet_tz := v_schedule.pet_timezone;
        if v_pet_tz is null then 
            v_pet_tz := 'UTC'; 
        end if;
        
        v_now_time := to_char(now() at time zone v_pet_tz, 'HH24:MI');

        -- 3. Check if this time corresponds to any target_time
        if v_now_time = any(v_schedule.target_times) then
            -- MATCH! Send Notification
            
            -- Prepare Body
            -- We can use pg_net to call the Edge Function
            -- Note: In production you should secure this with a secret key
             perform
                net.http_post(
                    url := v_func_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_service_key 
                    ),
                    body := jsonb_build_object(
                        'user_id', v_schedule.user_id,
                        'schedule_id', v_schedule.schedule_id,
                        'title', 'Feeding Time! 🐾',
                        'body', 'It''s ' || v_now_time || '. Time to ' || 
                                case 
                                    when v_schedule.label is not null and v_schedule.label != '' then v_schedule.label
                                    when v_schedule.task_type = 'medication' then 'give ' || v_schedule.pet_name || ' medication'
                                    when v_schedule.task_type = 'litter' then 'change litter'
                                    else 'feed ' || v_schedule.pet_name
                                end,
                        'url', '/dashboard'
                    )
                );
        end if;
    end loop;
end;
$$;

-- Schedule the cron job to run every minute
select cron.schedule(
    'check_notifications_emin', -- name of the cron job
    '* * * * *',                -- every minute
    'select public.match_schedules_and_notify()'
);

-- Maintenance: Clean up logs every Sunday at midnight (keep last 7 days)
select cron.schedule(
    'cleanup_cron_logs',
    '0 0 * * 0', -- Weekly
    'delete from cron.job_run_details where end_time < now() - interval ''7 days'''
);
