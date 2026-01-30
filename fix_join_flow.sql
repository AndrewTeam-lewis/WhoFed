-- Function to get household info for join page (public safe)
-- Runs as Security Definer to bypass RLS for non-members
-- This allows a user to "preview" a household before joining it

create or replace function get_household_join_info(_household_id uuid)
returns table (
  owner_name text,
  member_count bigint
)
language plpgsql
security definer
as $$
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
