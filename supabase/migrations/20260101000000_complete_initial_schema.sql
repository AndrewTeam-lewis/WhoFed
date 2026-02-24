-- ============================================================================
-- WhoFed Complete Initial Schema
-- This migration creates the entire database schema from scratch
-- Safe to run on empty databases (dev/qa)
-- ============================================================================

-- PostgreSQL 13+ has built-in gen_random_uuid(), no extension needed

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    first_name text,
    last_name text,
    username text UNIQUE,
    phone text,
    tier text DEFAULT 'free'::text NOT NULL,
    language text DEFAULT 'en'::text,
    push_subscription jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Households table
CREATE TABLE IF NOT EXISTS public.households (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name text,
    subscription_status text DEFAULT 'inactive'::text
);

-- Household members junction table
CREATE TABLE IF NOT EXISTS public.household_members (
    household_id uuid REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    can_edit boolean DEFAULT true,
    can_log boolean DEFAULT true,
    is_active boolean DEFAULT true,
    PRIMARY KEY (household_id, user_id)
);

-- Household keys (for joining via link/QR code)
CREATE TABLE IF NOT EXISTS public.household_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid REFERENCES public.households(id) ON DELETE CASCADE NOT NULL UNIQUE,
    key_value text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);

-- Household invitations
CREATE TABLE IF NOT EXISTS public.household_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    invited_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    invited_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(household_id, invited_user_id)
);

-- Pets table
CREATE TABLE IF NOT EXISTS public.pets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
    name text NOT NULL,
    species text,
    icon text DEFAULT '🐾'::text,
    pet_timezone text DEFAULT 'America/New_York'::text NOT NULL,
    created_by uuid REFERENCES public.profiles(id)
);

-- Schedules table (recurring task definitions)
CREATE TABLE IF NOT EXISTS public.schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id uuid REFERENCES public.pets(id) ON DELETE CASCADE,
    task_type text,
    label text NOT NULL,
    schedule_mode text,
    target_times text[],
    interval_hours integer,
    dosage text,
    is_enabled boolean DEFAULT true
);

-- Daily tasks table (generated from schedules)
CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    pet_id uuid REFERENCES public.pets(id) ON DELETE CASCADE NOT NULL,
    schedule_id uuid REFERENCES public.schedules(id) ON DELETE CASCADE,
    task_type text NOT NULL,
    label text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    user_id uuid REFERENCES public.profiles(id),
    status text DEFAULT 'pending'::text
);

-- Activity log (history of completed tasks)
CREATE TABLE IF NOT EXISTS public.activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    pet_id uuid REFERENCES public.pets(id),
    schedule_id uuid REFERENCES public.schedules(id),
    task_id uuid REFERENCES public.daily_tasks(id),
    action_type text NOT NULL,
    performed_at timestamp with time zone DEFAULT now()
);

-- Reminder settings
CREATE TABLE IF NOT EXISTS public.reminder_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    household_id uuid REFERENCES public.households(id) ON DELETE CASCADE NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    reminder_time text DEFAULT '09:00'::text NOT NULL,
    days_of_week integer[] DEFAULT ARRAY[1,2,3,4,5,6,7] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(user_id, household_id)
);

-- Notification templates (for i18n push notifications)
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key text NOT NULL UNIQUE,
    language text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(template_key, language)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Critical performance indexes
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_pets_household_id ON public.pets(household_id);
CREATE INDEX IF NOT EXISTS idx_schedules_pet_id ON public.schedules(pet_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_household_id ON public.daily_tasks(household_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_pet_id ON public.daily_tasks(pet_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_due_at ON public.daily_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_status ON public.daily_tasks(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_pet_id ON public.activity_log(pet_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_performed_at ON public.activity_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_household_invitations_invited_user ON public.household_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_household_invitations_household ON public.household_invitations(household_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_tasks_household_status ON public.daily_tasks(household_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_household_due ON public.daily_tasks(household_id, due_at);

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS (Security Definer to avoid infinite recursion)
-- ============================================================================

-- Helper function to check household membership without recursion
CREATE OR REPLACE FUNCTION public.is_household_member(_household_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM household_members
    WHERE household_id = _household_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Households policies (using helper function to avoid infinite recursion)
CREATE POLICY "Household members can view household" ON public.households
    FOR SELECT USING (
        auth.uid() = owner_id
        OR
        is_household_member(id)
    );

CREATE POLICY "Household owners can update household" ON public.households
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create households" ON public.households
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Household members policies (using helper function to avoid infinite recursion)
CREATE POLICY "Members can view household members" ON public.household_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR
        is_household_member(household_id)
    );

CREATE POLICY "Owners can manage members" ON public.household_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.households
            WHERE id = household_members.household_id AND owner_id = auth.uid()
        )
    );

-- Household keys policies (using helper function)
CREATE POLICY "Members can view household keys" ON public.household_keys
    FOR SELECT USING (is_household_member(household_id));

-- Pets policies (using helper function)
CREATE POLICY "Household members can view pets" ON public.pets
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Members with edit permission can manage pets" ON public.pets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = pets.household_id
            AND user_id = auth.uid()
            AND can_edit = true
        )
    );

-- Schedules policies (using helper function)
CREATE POLICY "Household members can view schedules" ON public.schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pets
            WHERE pets.id = schedules.pet_id
            AND is_household_member(pets.household_id)
        )
    );

CREATE POLICY "Members with edit permission can manage schedules" ON public.schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pets
            JOIN public.household_members ON pets.household_id = household_members.household_id
            WHERE pets.id = schedules.pet_id
            AND household_members.user_id = auth.uid()
            AND household_members.can_edit = true
        )
    );

-- Daily tasks policies (using helper function)
CREATE POLICY "Household members can view tasks" ON public.daily_tasks
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Members with log permission can update tasks" ON public.daily_tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = daily_tasks.household_id
            AND user_id = auth.uid()
            AND can_log = true
        )
    );

CREATE POLICY "Members with edit permission can manage tasks" ON public.daily_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.household_members
            WHERE household_id = daily_tasks.household_id
            AND user_id = auth.uid()
            AND can_edit = true
        )
    );

-- Activity log policies (using helper function)
CREATE POLICY "Household members can view activity" ON public.activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.pets
            WHERE pets.id = activity_log.pet_id
            AND is_household_member(pets.household_id)
        )
    );

CREATE POLICY "Members with log permission can insert activity" ON public.activity_log
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Reminder settings policies
CREATE POLICY "Users can manage own reminder settings" ON public.reminder_settings
    FOR ALL USING (user_id = auth.uid());

-- Notification templates policies (public read)
CREATE POLICY "Anyone can view notification templates" ON public.notification_templates
    FOR SELECT USING (true);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Debug view for households
CREATE OR REPLACE VIEW public.debug_households_view AS
SELECT
    h.id AS household_id,
    h.owner_id,
    h.subscription_status,
    p.email AS owner_email,
    p.first_name || ' ' || COALESCE(p.last_name, '') AS owner_name
FROM public.households h
JOIN public.profiles p ON h.owner_id = p.id;

-- Debug view for members
CREATE OR REPLACE VIEW public.debug_members_view AS
SELECT
    hm.household_id,
    hm.user_id,
    hm.can_edit,
    hm.can_log,
    hm.is_active,
    p.email AS user_email,
    p.first_name || ' ' || COALESCE(p.last_name, '') AS user_name,
    h.owner_id AS household_owner_id
FROM public.household_members hm
JOIN public.profiles p ON hm.user_id = p.id
JOIN public.households h ON hm.household_id = h.id;

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create pet-avatars bucket for pet photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-avatars', 'pet-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pet-avatars
CREATE POLICY "Authenticated users can upload pet avatars"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'pet-avatars'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Anyone can view pet avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'pet-avatars');

CREATE POLICY "Users can update own pet avatars"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'pet-avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own pet avatars"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'pet-avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================================================
-- COMPLETE
-- ============================================================================
