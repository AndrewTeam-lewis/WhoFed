-- Migration: Add language to profiles and create notification templates
-- Created at: 2026-02-19

-- 1. Add language column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- 2. Create notification_templates table
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    language text NOT NULL,
    key text NOT NULL, -- e.g. 'feed', 'medication', 'litter', 'default', 'title'
    title_template text,
    body_template text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(language, key)
);

-- 3. Enable RLS and add basic policies (Public read/write? Or just read?)
-- Clients need to read templates for one-time tasks (local notifications)
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.notification_templates
    FOR SELECT TO authenticated, anon
    USING (true);

-- Only service role or admins should write (for now, we insert via migration)

-- 4. Insert Default Templates (English)
INSERT INTO public.notification_templates (language, key, title_template, body_template)
VALUES
    ('en', 'feeeding_title', 'Feeding Time! 🐾', null),
    ('en', 'onetime_title', 'One-Time Reminder 🐾', null),
    ('en', 'feed', null, 'It''s {{time}}. Time to feed {{pet_name}}'),
    ('en', 'medication', null, 'It''s {{time}}. Time to give {{pet_name}} medication'),
    ('en', 'litter', null, 'It''s {{time}}. Time to change litter'),
    ('en', 'custom', null, 'It''s {{time}}. Time to {{label}}'),
    ('en', 'default', null, 'It''s {{time}}. Time to attend to {{pet_name}}')
ON CONFLICT (language, key) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;

-- 5. Insert Default Templates (Portuguese)
INSERT INTO public.notification_templates (language, key, title_template, body_template)
VALUES
    ('pt', 'feeeding_title', 'Hora de Comer! 🐾', null),
    ('pt', 'onetime_title', 'Lembrete Único 🐾', null),
    ('pt', 'feed', null, 'São {{time}}. Hora de alimentar {{pet_name}}'),
    ('pt', 'medication', null, 'São {{time}}. Hora de dar remédio para {{pet_name}}'),
    ('pt', 'litter', null, 'São {{time}}. Hora de trocar a areia'),
    ('pt', 'custom', null, 'São {{time}}. Hora de {{label}}'),
    ('pt', 'default', null, 'São {{time}}. Hora de cuidar de {{pet_name}}')
ON CONFLICT (language, key) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template;


-- 6. Update notification function to use templates
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
            else 
                v_key := 'default';
            end if;

            -- Get Title
            select title_template into v_template_title 
            from notification_templates 
            where language = coalesce(v_schedule.language, 'en') and key = 'feeeding_title'; -- Using generic title for now or specific? Existing used "Feeding Time" for everything.
            
            if v_template_title is null then v_template_title := 'Feeding Time! 🐾'; end if;

            -- Get Body
            select body_template into v_template_body 
            from notification_templates 
            where language = coalesce(v_schedule.language, 'en') and key = v_key;

            if v_template_body is null then
                 -- Fallback if template missing
                 if v_key = 'custom' then v_template_body := 'It''s {{time}}. Time to {{label}}';
                 else v_template_body := 'It''s {{time}}. Time to attend to {{pet_name}}';
                 end if;
            end if;

            -- Replace Placeholders
            v_body := replace(v_template_body, '{{time}}', v_now_time);
            v_body := replace(v_body, '{{pet_name}}', coalesce(v_schedule.pet_name, ''));
            v_body := replace(v_body, '{{label}}', coalesce(v_schedule.label, ''));

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
            v_key := 'custom'; -- Use custom template "Time to {{label}}"
        else
            v_key := 'default';
        end if;

         -- Get Title
        select title_template into v_template_title 
        from notification_templates 
        where language = coalesce(v_schedule.language, 'en') and key = 'onetime_title';
        
        if v_template_title is null then v_template_title := 'One-Time Reminder 🐾'; end if;

        -- Get Body
        select body_template into v_template_body 
        from notification_templates 
        where language = coalesce(v_schedule.language, 'en') and key = v_key;

        if v_template_body is null then v_template_body := 'It''s {{time}}. Time to {{label}}'; end if;

        -- Replace Placeholders
        v_body := replace(v_template_body, '{{time}}', v_schedule.task_time_str);
        v_body := replace(v_body, '{{pet_name}}', v_schedule.pet_name);
        v_body := replace(v_body, '{{label}}', coalesce(v_schedule.label, 'do task'));
        
        -- Special case: if template is "Time to {{label}}" and label is empty, might look weird.
        -- But one-time tasks usually have labels.

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
