-- Fix overlapping cron schedule and delegate localization to Edge Function
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
    v_func_url text := 'https://ryrwlkbzyldzbscvcqjh.supabase.co/functions/v1/send-push'; 
    v_service_key text := 'YOUR_SERVICE_ROLE_KEY'; 
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
            pr.language,
            hm.user_id,
            pr.push_subscription
        from schedules s
        join pets p on s.pet_id = p.id
        join household_members hm on p.household_id = hm.household_id
        join profiles pr on hm.user_id = pr.id
        left join reminder_settings rs on rs.schedule_id = s.id and rs.user_id = hm.user_id
        where 
            s.is_enabled = true
            and (rs.is_enabled is true or rs.is_enabled is null) 
            and pr.push_subscription is not null 
    loop
        v_pet_tz := coalesce(v_schedule.pet_timezone, 'UTC');
        v_now_time := to_char(now() at time zone v_pet_tz, 'HH24:MI');

        -- 3. Check if this time corresponds to any target_time
        if v_now_time = any(v_schedule.target_times) then
            -- Skip if already completed today
            if not exists (
                select 1 from daily_tasks 
                where schedule_id = v_schedule.schedule_id 
                and status = 'completed'
                and date(completed_at at time zone v_pet_tz) = date(now() at time zone v_pet_tz)
            ) then
                 perform net.http_post(
                    url := v_func_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_service_key 
                    ),
                    body := jsonb_build_object(
                        'user_id', v_schedule.user_id,
                        'schedule_id', v_schedule.schedule_id,
                        'language', coalesce(v_schedule.language, 'en'),
                        'pet_name', v_schedule.pet_name,
                        'task_type', v_schedule.task_type,
                        'label', v_schedule.label,
                        'task_time_str', v_now_time,
                        'url', '/app'
                    )
                );
            end if;
        end if;
    end loop;

    -- 2. ONE-TIME TASKS (NEW)
    -- Tasks due within the last minute (to avoid double sending if job slightly delayed)
    -- Fixed logic to > (now() - interval '1 minute') instead of >= to prevent duplicate triggers
    for v_schedule in 
        select 
            t.id as task_id,
            t.label,
            t.task_type,
            p.pet_timezone,
            p.name as pet_name,
            pr.language,
            hm.user_id,
            to_char(t.due_at at time zone coalesce(p.pet_timezone, 'UTC'), 'HH24:MI') as task_time_str
        from daily_tasks t
        join pets p on t.pet_id = p.id
        join household_members hm on p.household_id = hm.household_id
        join profiles pr on hm.user_id = pr.id
        where 
            t.schedule_id is null -- explicit one-time tasks
            and (t.status is null or t.status != 'completed')
            and t.due_at > (now() - interval '1 minute') 
            and t.due_at <= now()
            and pr.push_subscription is not null
    loop
        perform net.http_post(
            url := v_func_url,
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
            body := jsonb_build_object(
                'user_id', v_schedule.user_id,
                'language', coalesce(v_schedule.language, 'en'),
                'pet_name', v_schedule.pet_name,
                'task_type', v_schedule.task_type,
                'label', v_schedule.label,
                'task_time_str', v_schedule.task_time_str,
                'is_one_time', true,
                'url', '/app'
            )
        );
    end loop;
end;
$$;
