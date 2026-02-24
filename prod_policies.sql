-- ============================================================================
-- PRODUCTION RLS POLICIES - EXPORTED FROM PROD DATABASE
-- ============================================================================
-- This file contains all RLS policies from production.
-- Apply to dev/qa after dropping all existing policies to ensure exact match.
-- ============================================================================

-- ACTIVITY_LOG POLICIES
CREATE POLICY "Household members can insert logs" ON activity_log FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM pets WHERE ((pets.id = activity_log.pet_id) AND is_household_member(pets.household_id)))));

CREATE POLICY "Household members can view logs" ON activity_log FOR SELECT USING ((EXISTS ( SELECT 1 FROM pets WHERE ((pets.id = activity_log.pet_id) AND is_household_member(pets.household_id)))));

CREATE POLICY "Members can insert activity" ON activity_log FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM household_members WHERE ((household_members.household_id = ( SELECT pets.household_id FROM pets WHERE (pets.id = activity_log.pet_id))) AND (household_members.user_id = auth.uid()) AND (household_members.can_log = true) AND (household_members.is_active = true)))));

CREATE POLICY "Members can view activity history" ON activity_log FOR SELECT USING ((EXISTS ( SELECT 1 FROM household_members WHERE ((household_members.household_id = ( SELECT pets.household_id FROM pets WHERE (pets.id = activity_log.pet_id))) AND (household_members.user_id = auth.uid()) AND (household_members.is_active = true)))));

-- DAILY_TASKS POLICIES
CREATE POLICY "Household members can manage daily tasks" ON daily_tasks FOR ALL USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));

CREATE POLICY "Household members can manage tasks" ON daily_tasks FOR ALL USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));

CREATE POLICY "Users can insert tasks" ON daily_tasks FOR INSERT WITH CHECK ((household_id IN ( SELECT household_members.household_id FROM household_members WHERE (household_members.user_id = auth.uid()))));

CREATE POLICY "Users can update tasks" ON daily_tasks FOR UPDATE USING ((household_id IN ( SELECT household_members.household_id FROM household_members WHERE (household_members.user_id = auth.uid()))));

CREATE POLICY "Users can view tasks" ON daily_tasks FOR SELECT USING ((household_id IN ( SELECT household_members.household_id FROM household_members WHERE (household_members.user_id = auth.uid()))));

-- HOUSEHOLD_INVITATIONS POLICIES
CREATE POLICY "Invitees can update their invites" ON household_invitations FOR UPDATE USING ((invited_user_id = auth.uid()));

CREATE POLICY "Members can create invitations" ON household_invitations FOR INSERT WITH CHECK (is_household_member(household_id));

CREATE POLICY "Owners can create invites" ON household_invitations FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM households WHERE ((households.id = household_invitations.household_id) AND (households.owner_id = auth.uid())))));

CREATE POLICY "Owners can view household invites" ON household_invitations FOR SELECT USING ((EXISTS ( SELECT 1 FROM households WHERE ((households.id = household_invitations.household_id) AND (households.owner_id = auth.uid())))));

CREATE POLICY "Users can view their invitations" ON household_invitations FOR SELECT USING (((invited_user_id = auth.uid()) OR (invited_by = auth.uid()) OR is_household_member(household_id)));

CREATE POLICY "Users can view their invites" ON household_invitations FOR SELECT USING ((invited_user_id = auth.uid()));

-- HOUSEHOLD_KEYS POLICIES
CREATE POLICY "Owners can insert household key" ON household_keys FOR INSERT WITH CHECK ((auth.uid() IN ( SELECT households.owner_id FROM households WHERE (households.id = household_keys.household_id))));

CREATE POLICY "Owners can update their household key" ON household_keys FOR UPDATE USING ((auth.uid() IN ( SELECT households.owner_id FROM households WHERE (households.id = household_keys.household_id))));

CREATE POLICY "Owners can view their household key" ON household_keys FOR SELECT USING ((auth.uid() IN ( SELECT households.owner_id FROM households WHERE (households.id = household_keys.household_id))));

-- HOUSEHOLD_MEMBERS POLICIES
CREATE POLICY "Members can view household members" ON household_members FOR SELECT USING (((user_id = auth.uid()) OR is_household_member(household_id)));

CREATE POLICY "Owners can add members" ON household_members FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM households WHERE ((households.id = household_members.household_id) AND (households.owner_id = auth.uid())))));

CREATE POLICY "Owners can remove members" ON household_members FOR DELETE USING ((household_id IN ( SELECT households.id FROM households WHERE (households.owner_id = auth.uid()))));

CREATE POLICY "Owners can update members" ON household_members FOR UPDATE USING ((EXISTS ( SELECT 1 FROM households WHERE ((households.id = household_members.household_id) AND (households.owner_id = auth.uid())))));

CREATE POLICY "Users can leave household" ON household_members FOR DELETE USING ((auth.uid() = user_id));

CREATE POLICY "Users can view members of their households" ON household_members FOR SELECT USING ((household_id IN ( SELECT get_my_households() AS get_my_households)));

-- HOUSEHOLDS POLICIES
CREATE POLICY "Owners can update their own household" ON households FOR UPDATE USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));

CREATE POLICY "Users can delete their own households" ON households FOR DELETE USING ((auth.uid() = owner_id));

CREATE POLICY "Users can insert their own household" ON households FOR INSERT WITH CHECK ((auth.uid() = owner_id));

CREATE POLICY "Users can view households" ON households FOR SELECT USING (((auth.uid() = owner_id) OR is_household_member_or_invited(id)));

-- NOTIFICATION_TEMPLATES POLICIES
CREATE POLICY "Allow public read access" ON notification_templates FOR SELECT USING (true);

-- PETS POLICIES
CREATE POLICY "Household members can manage pets" ON pets FOR ALL USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));

CREATE POLICY "Owners can delete pets" ON pets FOR DELETE USING ((EXISTS ( SELECT 1 FROM households WHERE ((households.id = pets.household_id) AND (households.owner_id = auth.uid())))));

CREATE POLICY "Users can insert pets for their households" ON pets FOR INSERT WITH CHECK ((EXISTS ( SELECT 1 FROM household_members WHERE ((household_members.household_id = pets.household_id) AND (household_members.user_id = auth.uid())))));

CREATE POLICY "Users can view pets in their household" ON pets FOR SELECT USING ((EXISTS ( SELECT 1 FROM household_members WHERE ((household_members.household_id = pets.household_id) AND (household_members.user_id = auth.uid()) AND (household_members.is_active = true)))));

-- PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING ((auth.uid() = id));

CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING ((auth.uid() = id));

-- REMINDER_SETTINGS POLICIES
CREATE POLICY "Users can insert or update their own reminder settings" ON reminder_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own reminder settings" ON reminder_settings FOR UPDATE USING ((auth.uid() = user_id));

CREATE POLICY "Users can view their own reminder settings" ON reminder_settings FOR SELECT USING ((auth.uid() = user_id));

-- SCHEDULES POLICIES
CREATE POLICY "Admins can edit schedules" ON schedules FOR ALL USING ((EXISTS ( SELECT 1 FROM household_members WHERE ((household_members.household_id = ( SELECT pets.household_id FROM pets WHERE (pets.id = schedules.pet_id))) AND (household_members.user_id = auth.uid()) AND (household_members.can_edit = true)))));

CREATE POLICY "Household members can manage schedules" ON schedules FOR ALL USING ((EXISTS ( SELECT 1 FROM pets WHERE ((pets.id = schedules.pet_id) AND is_household_member(pets.household_id))))) WITH CHECK ((EXISTS ( SELECT 1 FROM pets WHERE ((pets.id = schedules.pet_id) AND is_household_member(pets.household_id)))));

CREATE POLICY "Members can view schedules" ON schedules FOR SELECT USING ((EXISTS ( SELECT 1 FROM household_members WHERE ((household_members.household_id = ( SELECT pets.household_id FROM pets WHERE (pets.id = schedules.pet_id))) AND (household_members.user_id = auth.uid()) AND (household_members.is_active = true)))));

-- ============================================================================
-- NOTES:
-- - This SQL uses two helper functions: is_household_member() and is_household_member_or_invited()
-- - It also uses get_my_households() function
-- - Make sure these functions exist in dev/qa before applying these policies
-- ============================================================================
