-- Update notification function to include one-time tasks
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

    -- 2. ONE-TIME TASKS (NEW)
    -- Tasks due within the last minute (to avoid double sending if job slightly delayed)
    for v_schedule in 
        select 
            t.id as task_id,
            t.label,
            t.task_type,
            p.name as pet_name,
            hm.user_id,
            to_char(t.due_at at time zone coalesce(p.pet_timezone, 'UTC'), 'HH24:MI') as task_time_str
        from daily_tasks t
        join pets p on t.pet_id = p.id
        join household_members hm on p.household_id = hm.household_id
        join profiles pr on hm.user_id = pr.id
        where 
            t.schedule_id is null -- explicit one-time tasks
            and t.status != 'completed'
            and t.due_at >= (now() - interval '1 minute') 
            and t.due_at <= now()
            and pr.push_subscription is not null
    loop
        perform net.http_post(
            url := v_func_url,
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
            body := jsonb_build_object(
                'user_id', v_schedule.user_id,
                'title', 'One-Time Reminder 🐾',
                'body', 'It''s ' || v_schedule.task_time_str || '. Time to ' || 
                        case 
                            when v_schedule.label is not null then 'feed ' || v_schedule.pet_name || ' ' || v_schedule.label
                            else 'do task for ' || v_schedule.pet_name
                        end,
                'url', '/dashboard'
            )
        );
    end loop;
end;
$$;
