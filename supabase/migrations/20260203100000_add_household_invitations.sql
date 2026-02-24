-- Household invitations table for username-based invite flow
CREATE TABLE IF NOT EXISTS household_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invited_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invited_by uuid NOT NULL REFERENCES profiles(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(household_id, invited_user_id, status)
);

ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- Invitees can see their own invites
CREATE POLICY "Users can view their invites"
ON household_invitations FOR SELECT
USING (invited_user_id = auth.uid());

-- Household owners can see invites for their households
CREATE POLICY "Owners can view household invites"
ON household_invitations FOR SELECT
USING (EXISTS (SELECT 1 FROM households WHERE id = household_id AND owner_id = auth.uid()));

-- Household owners can create invites
CREATE POLICY "Owners can create invites"
ON household_invitations FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM households WHERE id = household_id AND owner_id = auth.uid()));

-- Invitees can update their own invites (accept/decline)
CREATE POLICY "Invitees can update their invites"
ON household_invitations FOR UPDATE
USING (invited_user_id = auth.uid());

-- RPC: invite a user by username
CREATE OR REPLACE FUNCTION invite_user_by_username(p_username text, p_household_id uuid)
RETURNS json AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
