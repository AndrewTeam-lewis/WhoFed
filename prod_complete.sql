


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_household_invite"("p_invite_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_invite record;
BEGIN
    SELECT * INTO v_invite FROM household_invitations WHERE id = p_invite_id AND invited_user_id = auth.uid() AND status = 'pending';
    IF v_invite IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invite not found'); END IF;

    -- Add to members (reactivate if needed)
    INSERT INTO household_members (household_id, user_id, is_active, can_log, can_edit)
    VALUES (v_invite.household_id, auth.uid(), true, true, false)
    ON CONFLICT (household_id, user_id) DO UPDATE SET is_active = true;

    -- Cleanup old invites to prevent duplicate key error
    DELETE FROM household_invitations WHERE household_id = v_invite.household_id AND invited_user_id = auth.uid() AND status IN ('accepted', 'declined') AND id != p_invite_id;

    -- Mark current as accepted
    UPDATE household_invitations SET status = 'accepted' WHERE id = p_invite_id;
    RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."accept_household_invite"("p_invite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete the auth user (this will cascade to profiles if FK is set up)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."delete_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_household_from_key"("lookup_key" "text") RETURNS TABLE("household_id" "uuid", "owner_name" "text", "member_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _found_id uuid;
begin
  -- Find household by key
  select hk.household_id into _found_id
  from public.household_keys hk
  where hk.key_value = lookup_key
    and hk.expires_at > now();
  if _found_id is null then
    return;
  end if;
  return query
  select
    h.id,
    coalesce(p.first_name, 'Someone'),
    (select count(*) from public.household_members hm where hm.household_id = h.id)
  from public.households h
  join public.profiles p on h.owner_id = p.id
  where h.id = _found_id;
end;
$$;


ALTER FUNCTION "public"."get_household_from_key"("lookup_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_household_join_info"("_household_id" "uuid") RETURNS TABLE("owner_name" "text", "member_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return query
  select
    coalesce(p.first_name, 'Unknown') as owner_name,
    (select count(*) from household_members hm where hm.household_id = h.id) as member_count
  from households h
  left join profiles p on p.id = h.owner_id
  where h.id = _household_id;
end;
$$;


ALTER FUNCTION "public"."get_household_join_info"("_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_households"() RETURNS SETOF "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_households"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'first_name',
    new.email
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_user_by_identifier"("p_identifier" "text", "p_household_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id uuid;
    v_already_member boolean;
    v_already_invited boolean;
    v_is_email boolean;
    v_household_name text;
    v_invite_key text;
BEGIN
    -- Detect if input looks like an email
    v_is_email := p_identifier LIKE '%@%.%';

    IF v_is_email THEN
        SELECT id INTO v_user_id FROM profiles WHERE lower(email) = lower(p_identifier);
    ELSE
        -- Strip leading @ if present
        SELECT id INTO v_user_id FROM profiles WHERE lower(username) = lower(ltrim(p_identifier, '@'));
    END IF;

    -- If user doesn't exist AND it's an email, return info to send email invite
    IF v_user_id IS NULL THEN
        IF v_is_email THEN
            -- Get household name and invite key for email
            SELECT name INTO v_household_name FROM households WHERE id = p_household_id;
            SELECT key_value INTO v_invite_key FROM household_keys WHERE household_id = p_household_id;

            RETURN json_build_object(
                'success', true,
                'is_new_user', true,
                'email', p_identifier,
                'household_name', v_household_name,
                'invite_key', v_invite_key
            );
        ELSE
            -- Username provided but user doesn't exist
            RETURN json_build_object('success', false, 'error', 'No user found with that username');
        END IF;
    END IF;

    -- User exists - proceed with existing logic

    -- Cannot invite yourself
    IF v_user_id = auth.uid() THEN
        RETURN json_build_object('success', false, 'error', 'You cannot invite yourself');
    END IF;

    -- Check not already a member
    SELECT EXISTS(SELECT 1 FROM household_members WHERE household_id = p_household_id AND user_id = v_user_id) INTO v_already_member;
    IF v_already_member THEN
        RETURN json_build_object('success', false, 'error', 'User is already a member');
    END IF;

    -- Check not already pending
    SELECT EXISTS(SELECT 1 FROM household_invitations WHERE household_id = p_household_id AND invited_user_id = v_user_id AND status = 'pending') INTO v_already_invited;
    IF v_already_invited THEN
        RETURN json_build_object('success', false, 'error', 'Invite already pending');
    END IF;

    -- Create the invite for existing user
    INSERT INTO household_invitations (household_id, invited_user_id, invited_by)
    VALUES (p_household_id, v_user_id, auth.uid());

    -- Return for existing users (client will trigger push notification)
    RETURN json_build_object(
        'success', true,
        'is_new_user', false,
        'invited_user_id', v_user_id
    );
END;
$$;


ALTER FUNCTION "public"."invite_user_by_identifier"("p_identifier" "text", "p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_user_by_username"("p_username" "text", "p_household_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id uuid;
    v_already_member boolean;
    v_already_invited boolean;
BEGIN
    -- Find user by username (case-insensitive)
    SELECT id INTO v_user_id FROM profiles WHERE lower(username) = lower(p_username);
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Cannot invite yourself
    IF v_user_id = auth.uid() THEN
        RETURN json_build_object('success', false, 'error', 'You cannot invite yourself');
    END IF;

    -- Check not already a member
    SELECT EXISTS(SELECT 1 FROM household_members WHERE household_id = p_household_id AND user_id = v_user_id) INTO v_already_member;
    IF v_already_member THEN
        RETURN json_build_object('success', false, 'error', 'User is already a member');
    END IF;

    -- Check not already pending
    SELECT EXISTS(SELECT 1 FROM household_invitations WHERE household_id = p_household_id AND invited_user_id = v_user_id AND status = 'pending') INTO v_already_invited;
    IF v_already_invited THEN
        RETURN json_build_object('success', false, 'error', 'Invite already pending');
    END IF;

    -- Create the invite
    INSERT INTO household_invitations (household_id, invited_user_id, invited_by)
    VALUES (p_household_id, v_user_id, auth.uid());

    RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."invite_user_by_username"("p_username" "text", "p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_household_member"("_household_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM household_members
    WHERE household_id = _household_id
    AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_household_member"("_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_household_member_or_invited"("_household_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = _household_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM household_invitations
    WHERE household_id = _household_id AND invited_user_id = auth.uid() AND status = 'pending'
  );
END;
$$;


ALTER FUNCTION "public"."is_household_member_or_invited"("_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_household_by_key"("p_household_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_already_member boolean;
BEGIN
    -- 1. Check not already a member
    SELECT EXISTS(
        SELECT 1 FROM household_members
        WHERE household_id = p_household_id AND user_id = auth.uid()
    ) INTO v_already_member;

    IF v_already_member THEN
        RETURN json_build_object('success', true, 'already_member', true);
    END IF;

    -- 2. Add user to household_members
    INSERT INTO household_members (household_id, user_id, is_active, can_log, can_edit)
    VALUES (p_household_id, auth.uid(), true, true, false);

    -- 3. Mark any pending invitations as accepted (if they exist)
    UPDATE household_invitations
    SET status = 'accepted'
    WHERE household_id = p_household_id
      AND invited_user_id = auth.uid()
      AND status = 'pending';

    RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."join_household_by_key"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_schedules_and_notify"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."match_schedules_and_notify"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid",
    "schedule_id" "uuid",
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "performed_at" timestamp with time zone DEFAULT "now"(),
    "task_id" "uuid"
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "schedule_id" "uuid",
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "label" "text" NOT NULL,
    "task_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "due_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "daily_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'skipped'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."daily_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "subscription_status" "text" DEFAULT 'active'::"text",
    "name" "text"
);


ALTER TABLE "public"."households" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "first_name" "text",
    "email" "text",
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "push_subscription" "jsonb",
    "language" "text" DEFAULT 'en'::"text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."debug_households_view" AS
 SELECT "h"."id" AS "household_id",
    "h"."owner_id",
    "p"."email" AS "owner_email",
    "p"."first_name" AS "owner_name",
    "h"."subscription_status"
   FROM ("public"."households" "h"
     LEFT JOIN "public"."profiles" "p" ON (("h"."owner_id" = "p"."id")));


ALTER VIEW "public"."debug_households_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_members" (
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "can_log" boolean DEFAULT true,
    "can_edit" boolean DEFAULT false
);


ALTER TABLE "public"."household_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."debug_members_view" AS
 SELECT "hm"."household_id",
    "h"."owner_id" AS "household_owner_id",
    "hm"."user_id",
    "p"."email" AS "user_email",
    "p"."first_name" AS "user_name",
    "hm"."can_log",
    "hm"."can_edit",
    "hm"."is_active"
   FROM (("public"."household_members" "hm"
     JOIN "public"."households" "h" ON (("hm"."household_id" = "h"."id")))
     LEFT JOIN "public"."profiles" "p" ON (("hm"."user_id" = "p"."id")));


ALTER VIEW "public"."debug_members_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "invited_user_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "household_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."household_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "key_value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."household_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "language" "text" NOT NULL,
    "key" "text" NOT NULL,
    "title_template" "text",
    "body_template" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid",
    "name" "text" NOT NULL,
    "species" "text",
    "pet_timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "icon" "text",
    "created_by" "uuid"
);


ALTER TABLE "public"."pets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminder_settings" (
    "user_id" "uuid" NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reminder_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid",
    "task_type" "text",
    "label" "text" NOT NULL,
    "dosage" "text",
    "schedule_mode" "text",
    "interval_hours" integer,
    "target_times" "text"[],
    "is_enabled" boolean DEFAULT true,
    CONSTRAINT "schedules_schedule_mode_check" CHECK (("schedule_mode" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedules" IS 'Task types: feeding, medication, care (generic care tasks like walks, litter, grooming)';



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_tasks"
    ADD CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_household_id_invited_user_id_status_key" UNIQUE ("household_id", "invited_user_id", "status");



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_keys"
    ADD CONSTRAINT "household_keys_household_id_key" UNIQUE ("household_id");



ALTER TABLE ONLY "public"."household_keys"
    ADD CONSTRAINT "household_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_pkey" PRIMARY KEY ("household_id", "user_id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_language_key_key" UNIQUE ("language", "key");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminder_settings"
    ADD CONSTRAINT "reminder_settings_pkey" PRIMARY KEY ("user_id", "schedule_id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_log_pet_id" ON "public"."activity_log" USING "btree" ("pet_id");



CREATE INDEX "idx_activity_log_pet_id_performed_at" ON "public"."activity_log" USING "btree" ("pet_id", "performed_at" DESC);



CREATE INDEX "idx_activity_log_task_id" ON "public"."activity_log" USING "btree" ("task_id");



CREATE INDEX "idx_activity_log_user_id" ON "public"."activity_log" USING "btree" ("user_id");



CREATE INDEX "idx_daily_tasks_completed_at" ON "public"."daily_tasks" USING "btree" ("completed_at") WHERE ("completed_at" IS NOT NULL);



CREATE INDEX "idx_daily_tasks_household_id_due_at" ON "public"."daily_tasks" USING "btree" ("household_id", "due_at");



CREATE INDEX "idx_daily_tasks_household_id_status" ON "public"."daily_tasks" USING "btree" ("household_id", "status");



CREATE INDEX "idx_daily_tasks_household_id_task_type" ON "public"."daily_tasks" USING "btree" ("household_id", "task_type", "status");



COMMENT ON INDEX "public"."idx_daily_tasks_household_id_task_type" IS 'High: Dashboard past medications query filters by household + task_type';



CREATE INDEX "idx_daily_tasks_pet_id" ON "public"."daily_tasks" USING "btree" ("pet_id");



CREATE INDEX "idx_daily_tasks_schedule_id_status_due_at" ON "public"."daily_tasks" USING "btree" ("schedule_id", "status", "due_at") WHERE ("schedule_id" IS NULL);



COMMENT ON INDEX "public"."idx_daily_tasks_schedule_id_status_due_at" IS 'Critical: Cron one-time task notifications - filters by schedule_id IS NULL + status + due_at range';



CREATE INDEX "idx_daily_tasks_status" ON "public"."daily_tasks" USING "btree" ("status");



CREATE INDEX "idx_daily_tasks_status_due_at" ON "public"."daily_tasks" USING "btree" ("status", "due_at");



COMMENT ON INDEX "public"."idx_daily_tasks_status_due_at" IS 'High: Dashboard queries filter by both status and due_at range';



CREATE INDEX "idx_household_invitations_household_id_status" ON "public"."household_invitations" USING "btree" ("household_id", "status");



CREATE INDEX "idx_household_invitations_invited_by" ON "public"."household_invitations" USING "btree" ("invited_by");



COMMENT ON INDEX "public"."idx_household_invitations_invited_by" IS 'High: Settings page "sent invitations" query joins on this FK';



CREATE INDEX "idx_household_invitations_invited_user_id_status" ON "public"."household_invitations" USING "btree" ("invited_user_id", "status");



CREATE INDEX "idx_household_keys_household_id" ON "public"."household_keys" USING "btree" ("household_id");



CREATE INDEX "idx_household_keys_key_value" ON "public"."household_keys" USING "btree" ("key_value");



CREATE INDEX "idx_household_members_household_id_is_active" ON "public"."household_members" USING "btree" ("household_id", "is_active");



CREATE INDEX "idx_household_members_is_active" ON "public"."household_members" USING "btree" ("is_active");



CREATE INDEX "idx_household_members_user_id" ON "public"."household_members" USING "btree" ("user_id");



CREATE INDEX "idx_households_owner_id" ON "public"."households" USING "btree" ("owner_id");



CREATE INDEX "idx_households_subscription_status" ON "public"."households" USING "btree" ("subscription_status");



CREATE INDEX "idx_pets_household_id" ON "public"."pets" USING "btree" ("household_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_push_subscription_notnull" ON "public"."profiles" USING "btree" ("id") WHERE ("push_subscription" IS NOT NULL);



COMMENT ON INDEX "public"."idx_profiles_push_subscription_notnull" IS 'Medium: Cron job filters to users with push enabled';



CREATE INDEX "idx_profiles_tier" ON "public"."profiles" USING "btree" ("tier");



CREATE INDEX "idx_reminder_settings_is_enabled" ON "public"."reminder_settings" USING "btree" ("is_enabled");



CREATE INDEX "idx_reminder_settings_schedule_id" ON "public"."reminder_settings" USING "btree" ("schedule_id");



CREATE INDEX "idx_reminder_settings_schedule_id_user_id" ON "public"."reminder_settings" USING "btree" ("schedule_id", "user_id", "is_enabled");



COMMENT ON INDEX "public"."idx_reminder_settings_schedule_id_user_id" IS 'Critical: Cron job LEFT JOIN optimization on reminder_settings';



CREATE INDEX "idx_schedules_is_enabled" ON "public"."schedules" USING "btree" ("is_enabled");



COMMENT ON INDEX "public"."idx_schedules_is_enabled" IS 'Critical: Cron job scans all schedules every minute - this reduces scan from O(n) to O(n_enabled)';



CREATE INDEX "idx_schedules_pet_id" ON "public"."schedules" USING "btree" ("pet_id");



CREATE INDEX "idx_schedules_pet_id_is_enabled" ON "public"."schedules" USING "btree" ("pet_id", "is_enabled");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."daily_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_tasks"
    ADD CONSTRAINT "daily_tasks_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_tasks"
    ADD CONSTRAINT "daily_tasks_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_tasks"
    ADD CONSTRAINT "daily_tasks_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_tasks"
    ADD CONSTRAINT "daily_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "hm_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."household_invitations"
    ADD CONSTRAINT "household_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_keys"
    ADD CONSTRAINT "household_keys_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminder_settings"
    ADD CONSTRAINT "reminder_settings_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminder_settings"
    ADD CONSTRAINT "reminder_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can edit schedules" ON "public"."schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."household_members"
  WHERE (("household_members"."household_id" = ( SELECT "pets"."household_id"
           FROM "public"."pets"
          WHERE ("pets"."id" = "schedules"."pet_id"))) AND ("household_members"."user_id" = "auth"."uid"()) AND ("household_members"."can_edit" = true)))));



CREATE POLICY "Allow public read access" ON "public"."notification_templates" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Household members can insert logs" ON "public"."activity_log" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "activity_log"."pet_id") AND "public"."is_household_member"("pets"."household_id")))));



CREATE POLICY "Household members can manage daily tasks" ON "public"."daily_tasks" USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "Household members can manage pets" ON "public"."pets" USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "Household members can manage schedules" ON "public"."schedules" USING ((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "schedules"."pet_id") AND "public"."is_household_member"("pets"."household_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "schedules"."pet_id") AND "public"."is_household_member"("pets"."household_id")))));



CREATE POLICY "Household members can manage tasks" ON "public"."daily_tasks" USING ("public"."is_household_member"("household_id")) WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "Household members can view logs" ON "public"."activity_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "activity_log"."pet_id") AND "public"."is_household_member"("pets"."household_id")))));



CREATE POLICY "Invitees can update their invites" ON "public"."household_invitations" FOR UPDATE USING (("invited_user_id" = "auth"."uid"()));



CREATE POLICY "Members can create invitations" ON "public"."household_invitations" FOR INSERT WITH CHECK ("public"."is_household_member"("household_id"));



CREATE POLICY "Members can insert activity" ON "public"."activity_log" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members"
  WHERE (("household_members"."household_id" = ( SELECT "pets"."household_id"
           FROM "public"."pets"
          WHERE ("pets"."id" = "activity_log"."pet_id"))) AND ("household_members"."user_id" = "auth"."uid"()) AND ("household_members"."can_log" = true) AND ("household_members"."is_active" = true)))));



CREATE POLICY "Members can view activity history" ON "public"."activity_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members"
  WHERE (("household_members"."household_id" = ( SELECT "pets"."household_id"
           FROM "public"."pets"
          WHERE ("pets"."id" = "activity_log"."pet_id"))) AND ("household_members"."user_id" = "auth"."uid"()) AND ("household_members"."is_active" = true)))));



CREATE POLICY "Members can view household members" ON "public"."household_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_household_member"("household_id")));



CREATE POLICY "Members can view schedules" ON "public"."schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members"
  WHERE (("household_members"."household_id" = ( SELECT "pets"."household_id"
           FROM "public"."pets"
          WHERE ("pets"."id" = "schedules"."pet_id"))) AND ("household_members"."user_id" = "auth"."uid"()) AND ("household_members"."is_active" = true)))));



CREATE POLICY "Owners can add members" ON "public"."household_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."households"
  WHERE (("households"."id" = "household_members"."household_id") AND ("households"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can create invites" ON "public"."household_invitations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."households"
  WHERE (("households"."id" = "household_invitations"."household_id") AND ("households"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can delete pets" ON "public"."pets" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."households"
  WHERE (("households"."id" = "pets"."household_id") AND ("households"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can insert household key" ON "public"."household_keys" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "households"."owner_id"
   FROM "public"."households"
  WHERE ("households"."id" = "household_keys"."household_id"))));



CREATE POLICY "Owners can remove members" ON "public"."household_members" FOR DELETE USING (("household_id" IN ( SELECT "households"."id"
   FROM "public"."households"
  WHERE ("households"."owner_id" = "auth"."uid"()))));



CREATE POLICY "Owners can update members" ON "public"."household_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."households"
  WHERE (("households"."id" = "household_members"."household_id") AND ("households"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can update their household key" ON "public"."household_keys" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "households"."owner_id"
   FROM "public"."households"
  WHERE ("households"."id" = "household_keys"."household_id"))));



CREATE POLICY "Owners can update their own household" ON "public"."households" FOR UPDATE USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can view household invites" ON "public"."household_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."households"
  WHERE (("households"."id" = "household_invitations"."household_id") AND ("households"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owners can view their household key" ON "public"."household_keys" FOR SELECT USING (("auth"."uid"() IN ( SELECT "households"."owner_id"
   FROM "public"."households"
  WHERE ("households"."id" = "household_keys"."household_id"))));



CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can delete their own households" ON "public"."households" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can insert or update their own reminder settings" ON "public"."reminder_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert pets for their households" ON "public"."pets" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members"
  WHERE (("household_members"."household_id" = "pets"."household_id") AND ("household_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert tasks" ON "public"."daily_tasks" FOR INSERT WITH CHECK (("household_id" IN ( SELECT "household_members"."household_id"
   FROM "public"."household_members"
  WHERE ("household_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert their own household" ON "public"."households" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can leave household" ON "public"."household_members" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own profile" ON "public"."profiles" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update tasks" ON "public"."daily_tasks" FOR UPDATE USING (("household_id" IN ( SELECT "household_members"."household_id"
   FROM "public"."household_members"
  WHERE ("household_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own reminder settings" ON "public"."reminder_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view households" ON "public"."households" FOR SELECT USING ((("auth"."uid"() = "owner_id") OR "public"."is_household_member_or_invited"("id")));



CREATE POLICY "Users can view members of their households" ON "public"."household_members" FOR SELECT USING (("household_id" IN ( SELECT "public"."get_my_households"() AS "get_my_households")));



CREATE POLICY "Users can view pets in their household" ON "public"."pets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members"
  WHERE (("household_members"."household_id" = "pets"."household_id") AND ("household_members"."user_id" = "auth"."uid"()) AND ("household_members"."is_active" = true)))));



CREATE POLICY "Users can view tasks" ON "public"."daily_tasks" FOR SELECT USING (("household_id" IN ( SELECT "household_members"."household_id"
   FROM "public"."household_members"
  WHERE ("household_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their invitations" ON "public"."household_invitations" FOR SELECT USING ((("invited_user_id" = "auth"."uid"()) OR ("invited_by" = "auth"."uid"()) OR "public"."is_household_member"("household_id")));



CREATE POLICY "Users can view their invites" ON "public"."household_invitations" FOR SELECT USING (("invited_user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own reminder settings" ON "public"."reminder_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."household_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."household_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."household_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminder_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."accept_household_invite"("p_invite_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_household_invite"("p_invite_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_household_invite"("p_invite_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_household_from_key"("lookup_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_household_from_key"("lookup_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_household_from_key"("lookup_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_household_join_info"("_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_household_join_info"("_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_household_join_info"("_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_households"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_households"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_households"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_user_by_identifier"("p_identifier" "text", "p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_user_by_identifier"("p_identifier" "text", "p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_user_by_identifier"("p_identifier" "text", "p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_user_by_username"("p_username" "text", "p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invite_user_by_username"("p_username" "text", "p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_user_by_username"("p_username" "text", "p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_member"("_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_member"("_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_member"("_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_member_or_invited"("_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_member_or_invited"("_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_member_or_invited"("_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_household_by_key"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."join_household_by_key"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_household_by_key"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_schedules_and_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."match_schedules_and_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_schedules_and_notify"() TO "service_role";
























GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."daily_tasks" TO "anon";
GRANT ALL ON TABLE "public"."daily_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."debug_households_view" TO "anon";
GRANT ALL ON TABLE "public"."debug_households_view" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_households_view" TO "service_role";



GRANT ALL ON TABLE "public"."household_members" TO "anon";
GRANT ALL ON TABLE "public"."household_members" TO "authenticated";
GRANT ALL ON TABLE "public"."household_members" TO "service_role";



GRANT ALL ON TABLE "public"."debug_members_view" TO "anon";
GRANT ALL ON TABLE "public"."debug_members_view" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_members_view" TO "service_role";



GRANT ALL ON TABLE "public"."household_invitations" TO "anon";
GRANT ALL ON TABLE "public"."household_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."household_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."household_keys" TO "anon";
GRANT ALL ON TABLE "public"."household_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."household_keys" TO "service_role";



GRANT ALL ON TABLE "public"."notification_templates" TO "anon";
GRANT ALL ON TABLE "public"."notification_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";



GRANT ALL ON TABLE "public"."pets" TO "anon";
GRANT ALL ON TABLE "public"."pets" TO "authenticated";
GRANT ALL ON TABLE "public"."pets" TO "service_role";



GRANT ALL ON TABLE "public"."reminder_settings" TO "anon";
GRANT ALL ON TABLE "public"."reminder_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."reminder_settings" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































