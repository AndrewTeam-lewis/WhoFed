-- Fix RLS: Allow invited users to see household details (name, etc.)
-- Uses is_household_member() helper to avoid infinite recursion
DROP POLICY IF EXISTS "Users can view households they belong to" ON households;
DROP POLICY IF EXISTS "Users can view households" ON households;

CREATE POLICY "Users can view households they belong to or are invited to"
ON households FOR SELECT
USING (
  auth.uid() = owner_id
  OR
  is_household_member(id)  -- Non-recursive helper function
  OR
  EXISTS (
    SELECT 1 FROM household_invitations
    WHERE household_id = households.id
    AND invited_user_id = auth.uid()
    AND status = 'pending'
  )
);


-- Fix RPC: Handle duplicate key error on accept (re-joining)
CREATE OR REPLACE FUNCTION accept_household_invite(p_invite_id uuid)
RETURNS json AS $$
DECLARE
    v_invite record;
BEGIN
    -- 1. Find the pending invite belonging to the current user
    SELECT * INTO v_invite
    FROM household_invitations
    WHERE id = p_invite_id
      AND invited_user_id = auth.uid()
      AND status = 'pending';

    IF v_invite IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invite not found or already handled');
    END IF;

    -- 2. Add user to household_members
    INSERT INTO household_members (household_id, user_id, is_active, can_log, can_edit)
    VALUES (v_invite.household_id, auth.uid(), true, true, false)
    ON CONFLICT (household_id, user_id) DO UPDATE
    SET is_active = true; -- Re-activate if they were previously there

    -- 3. Clean up OLD accepted/declined invites to prevent unique constraint violation
    -- (household_id, invited_user_id, status) unique index causes crash if we try to have 2 'accepted' rows
    DELETE FROM household_invitations
    WHERE household_id = v_invite.household_id
      AND invited_user_id = auth.uid()
      AND status IN ('accepted', 'declined')
      AND id != p_invite_id;

    -- 4. Mark THIS invite as accepted
    UPDATE household_invitations
    SET status = 'accepted'
    WHERE id = p_invite_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
