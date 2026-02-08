-- RPC: invite a user by username or email (auto-detect)
-- Updated 2026-02-08: Return invited_user_id for push notifications
CREATE OR REPLACE FUNCTION invite_user_by_identifier(p_identifier text, p_household_id uuid)
RETURNS json AS $$
DECLARE
    v_user_id uuid;
    v_already_member boolean;
    v_already_invited boolean;
    v_is_email boolean;
BEGIN
    -- Detect if input looks like an email
    v_is_email := p_identifier LIKE '%@%.%';

    IF v_is_email THEN
        SELECT id INTO v_user_id FROM profiles WHERE lower(email) = lower(p_identifier);
    ELSE
        -- Strip leading @ if present
        SELECT id INTO v_user_id FROM profiles WHERE lower(username) = lower(ltrim(p_identifier, '@'));
    END IF;

    IF v_user_id IS NULL THEN
        IF v_is_email THEN
            RETURN json_build_object('success', false, 'error', 'No user found with that email');
        ELSE
            RETURN json_build_object('success', false, 'error', 'No user found with that username');
        END IF;
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

    -- NEW: Return the ID so the client can trigger a push
    RETURN json_build_object('success', true, 'invited_user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
