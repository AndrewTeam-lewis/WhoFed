-- Migration: Improve notification templates
-- Remove timestamps and improve grammar
-- Created at: 2026-03-04

-- Update English templates (remove timestamps, better grammar)
INSERT INTO public.notification_templates (language, key, title_template, body_template)
VALUES
    ('en', 'feeeding_title', 'Reminder 🐾', null),
    ('en', 'onetime_title', 'Reminder 🐾', null),
    ('en', 'feed', null, 'Feed {{pet_name}}'),
    ('en', 'medication', null, '{{pet_name}} needs medication'),
    ('en', 'litter', null, 'Change litter'),
    ('en', 'care', null, 'Care task for {{pet_name}}'),
    ('en', 'custom', null, 'Time for {{pet_name}}''s {{label}}'),
    ('en', 'default', null, 'Task for {{pet_name}}')
ON CONFLICT (language, key) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;

-- Update Portuguese templates (remove timestamps, better grammar)
INSERT INTO public.notification_templates (language, key, title_template, body_template)
VALUES
    ('pt', 'feeeding_title', 'Lembrete 🐾', null),
    ('pt', 'onetime_title', 'Lembrete 🐾', null),
    ('pt', 'feed', null, 'Alimentar {{pet_name}}'),
    ('pt', 'medication', null, '{{pet_name}} precisa de remédio'),
    ('pt', 'litter', null, 'Trocar areia'),
    ('pt', 'care', null, 'Tarefa para {{pet_name}}'),
    ('pt', 'custom', null, 'Hora para {{label}} de {{pet_name}}'),
    ('pt', 'default', null, 'Tarefa para {{pet_name}}')
ON CONFLICT (language, key) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;

-- Update notification function to lowercase labels for better grammar
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
    v_service_key text := 'YOUR_SERVICE_ROLE_KEY'; -- In prod, use vault
    v_body text;
    v_title text;
    v_template_body text;
    v_template_title text;
    v_key text;
    v_label_lower text;
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
            pr.push_subscription,
            pr.language
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
        -- 2. Calculate current time in the PET'S timezone
        v_pet_tz := v_schedule.pet_timezone;
        if v_pet_tz is null then
            v_pet_tz := 'UTC';
        end if;

        v_now_time := to_char(now() at time zone v_pet_tz, 'HH24:MI');

        -- 3. Check if this time corresponds to any target_time
        if v_now_time = any(v_schedule.target_times) then

            -- FETCH TEMPLATES based on language (default to 'en' if null)
            -- Determine Key
            if v_schedule.label is not null and v_schedule.label != '' then
                v_key := 'custom';
            elsif v_schedule.task_type = 'medication' then
                v_key := 'medication';
            elsif v_schedule.task_type = 'litter' then
                v_key := 'litter';
            elsif v_schedule.task_type = 'feeding' then
                v_key := 'feed';
            elsif v_schedule.task_type = 'care' then
                v_key := 'care';
            else
                v_key := 'default';
            end if;

            -- Get Title
            select title_template into v_template_title
            from notification_templates
            where language = coalesce(v_schedule.language, 'en') and key = 'feeeding_title';

            if v_template_title is null then v_template_title := 'Reminder 🐾'; end if;

            -- Get Body
            select body_template into v_template_body
            from notification_templates
            where language = coalesce(v_schedule.language, 'en') and key = v_key;

            if v_template_body is null then
                 -- Fallback if template missing
                 if v_key = 'custom' then v_template_body := 'Time for {{pet_name}}''s {{label}}';
                 else v_template_body := 'Task for {{pet_name}}';
                 end if;
            end if;

            -- Lowercase the label for better grammar (e.g., "Soft food" -> "soft food")
            v_label_lower := lower(coalesce(v_schedule.label, ''));

            -- Replace Placeholders (NOTE: No more {{time}} replacement!)
            v_body := replace(v_template_body, '{{pet_name}}', coalesce(v_schedule.pet_name, ''));
            v_body := replace(v_body, '{{label}}', v_label_lower);

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
                        'title', v_template_title,
                        'body', v_body,
                        'url', '/dashboard'
                    )
                );
        end if;
    end loop;

    -- 2. ONE-TIME TASKS (Updated)
    for v_schedule in
        select
            t.id as task_id,
            t.label,
            t.task_type,
            p.name as pet_name,
            hm.user_id,
            to_char(t.due_at at time zone coalesce(p.pet_timezone, 'UTC'), 'HH24:MI') as task_time_str,
            pr.language
        from daily_tasks t
        join pets p on t.pet_id = p.id
        join household_members hm on p.household_id = hm.household_id
        join profiles pr on hm.user_id = pr.id
        where
            t.schedule_id is null
            and t.status != 'completed'
            and t.due_at >= (now() - interval '1 minute')
            and t.due_at <= now()
            and pr.push_subscription is not null
    loop
        -- Determine Key (One-time tasks usually have labels, but check type too)
        if v_schedule.label is not null and v_schedule.label != '' then
            v_key := 'custom';
        else
            v_key := 'default';
        end if;

         -- Get Title
        select title_template into v_template_title
        from notification_templates
        where language = coalesce(v_schedule.language, 'en') and key = 'onetime_title';

        if v_template_title is null then v_template_title := 'Reminder 🐾'; end if;

        -- Get Body
        select body_template into v_template_body
        from notification_templates
        where language = coalesce(v_schedule.language, 'en') and key = v_key;

        if v_template_body is null then v_template_body := 'Time for {{pet_name}}''s {{label}}'; end if;

        -- Lowercase the label for better grammar
        v_label_lower := lower(coalesce(v_schedule.label, 'task'));

        -- Replace Placeholders (NOTE: No more {{time}} replacement!)
        v_body := replace(v_template_body, '{{pet_name}}', v_schedule.pet_name);
        v_body := replace(v_body, '{{label}}', v_label_lower);

        perform net.http_post(
            url := v_func_url,
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
            body := jsonb_build_object(
                'user_id', v_schedule.user_id,
                'title', v_template_title,
                'body', v_body,
                'url', '/dashboard'
            )
        );
    end loop;
end;
$$;
