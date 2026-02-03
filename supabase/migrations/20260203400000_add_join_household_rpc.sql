-- RPC: join a household via invite key (bypasses RLS on household_members)
CREATE OR REPLACE FUNCTION join_household_by_key(p_household_id uuid)
RETURNS json AS $$
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

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
