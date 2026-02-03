-- RPC: accept a household invitation (bypasses RLS on household_members)
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
    ON CONFLICT DO NOTHING;

    -- 3. Mark invite as accepted
    UPDATE household_invitations
    SET status = 'accepted'
    WHERE id = p_invite_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
