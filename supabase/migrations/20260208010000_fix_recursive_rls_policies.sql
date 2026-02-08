-- ============================================================================
-- FIX RECURSIVE RLS POLICIES
-- ============================================================================
-- This migration fixes a critical issue with recursive RLS policies that
-- cause queries to hang or timeout. The original policy on household_members
-- was checking household_members within its own RLS check, creating a
-- circular dependency.
--
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to safely
-- check membership without recursion.
--
-- Priority: CRITICAL - Fixes "minutes to load" dashboard issue
-- ============================================================================

-- 1. Create Helper Function (Security Definer to bypass RLS)
-- This function runs with elevated privileges and bypasses RLS checks,
-- preventing infinite recursion when checking membership
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

-- 2. HOUSEHOLDS POLICIES
-- Drop old policies and recreate with non-recursive checks
DROP POLICY IF EXISTS "Users can insert their own household" ON households;
CREATE POLICY "Users can insert their own household"
ON households FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can view households they belong to" ON households;
DROP POLICY IF EXISTS "Users can view households" ON households;
CREATE POLICY "Users can view households"
ON households FOR SELECT
USING (
  auth.uid() = owner_id
  OR
  is_household_member(id) -- Safe, non-recursive function
);

-- 3. HOUSEHOLD MEMBERS POLICIES
-- This is the critical fix - removes recursive self-reference
DROP POLICY IF EXISTS "Owners can add members" ON household_members;
CREATE POLICY "Owners can add members"
ON household_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM households
    WHERE id = household_id
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can view household members" ON household_members;
CREATE POLICY "Members can view household members"
ON household_members FOR SELECT
USING (
  user_id = auth.uid()  -- You can always see your own membership
  OR
  is_household_member(household_id) -- Safe, non-recursive check
);

DROP POLICY IF EXISTS "Owners can update members" ON household_members;
CREATE POLICY "Owners can update members"
ON household_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM households
    WHERE id = household_id
    AND owner_id = auth.uid()
  )
);

-- 4. PETS POLICIES
-- Simplified using the helper function
DROP POLICY IF EXISTS "Household members can manage pets" ON pets;
CREATE POLICY "Household members can manage pets"
ON pets FOR ALL
USING (is_household_member(household_id))
WITH CHECK (is_household_member(household_id));

-- 5. SCHEDULES POLICIES
DROP POLICY IF EXISTS "Household members can manage schedules" ON schedules;
CREATE POLICY "Household members can manage schedules"
ON schedules FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM pets
    WHERE id = schedules.pet_id
    AND is_household_member(pets.household_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pets
    WHERE id = pet_id
    AND is_household_member(pets.household_id)
  )
);

-- 6. ACTIVITY LOG POLICIES
DROP POLICY IF EXISTS "Household members can view logs" ON activity_log;
CREATE POLICY "Household members can view logs"
ON activity_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pets
    WHERE id = activity_log.pet_id
    AND is_household_member(pets.household_id)
  )
);

DROP POLICY IF EXISTS "Household members can insert logs" ON activity_log;
CREATE POLICY "Household members can insert logs"
ON activity_log FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pets
    WHERE id = pet_id
    AND is_household_member(pets.household_id)
  )
);

-- 7. DAILY_TASKS POLICIES (if they exist)
DROP POLICY IF EXISTS "Household members can manage tasks" ON daily_tasks;
CREATE POLICY "Household members can manage tasks"
ON daily_tasks FOR ALL
USING (is_household_member(household_id))
WITH CHECK (is_household_member(household_id));

-- 8. HOUSEHOLD_INVITATIONS POLICIES (if they exist)
DROP POLICY IF EXISTS "Users can view their invitations" ON household_invitations;
CREATE POLICY "Users can view their invitations"
ON household_invitations FOR SELECT
USING (
  invited_user_id = auth.uid()
  OR
  invited_by = auth.uid()
  OR
  is_household_member(household_id)
);

DROP POLICY IF EXISTS "Members can create invitations" ON household_invitations;
CREATE POLICY "Members can create invitations"
ON household_invitations FOR INSERT
WITH CHECK (is_household_member(household_id));

-- Log successful completion
DO $$
BEGIN
  RAISE NOTICE 'RLS policies fixed successfully';
  RAISE NOTICE 'Recursive checks replaced with security definer function';
  RAISE NOTICE 'Dashboard should now load instantly';
END $$;
