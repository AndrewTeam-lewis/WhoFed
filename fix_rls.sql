-- Fix Infinite Recursion in RLS Policies

-- 1. Create a Secure Helper Function
-- This function runs with "security definer" privileges, meaning it bypasses RLS
-- to safely check if the current user is in a household.
create or replace function public.is_household_member(_household_id uuid)
returns boolean as $$
begin
  return exists (
    select 1
    from household_members
    where household_id = _household_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- 2. Fix 'Household Members' Policy (The Source of Recursion)
drop policy if exists "Members can view household members" on household_members;
create policy "Members can view household members"
on household_members for select
using (
  -- You can always see your own row
  user_id = auth.uid() 
  or
  -- You can see others if you are a member of the household
  is_household_member(household_id)
);

-- 3. Update 'Pets' Policy to use the safe function
drop policy if exists "Household members can manage pets" on pets;
create policy "Household members can manage pets"
on pets for all
using ( is_household_member(household_id) )
with check ( is_household_member(household_id) );

-- 4. Update 'Schedules' Policy
drop policy if exists "Household members can manage schedules" on schedules;
create policy "Household members can manage schedules"
on schedules for all
using (
    exists (
      select 1 from pets
      where id = schedules.pet_id
      and is_household_member(pets.household_id)
    )
)
with check (
    exists (
      select 1 from pets
      where id = pet_id
      and is_household_member(pets.household_id)
    )
);

-- 5. Update 'Activity Log' Policies
drop policy if exists "Household members can view logs" on activity_log;
create policy "Household members can view logs"
on activity_log for select
using (
    exists (
      select 1 from pets
      where id = activity_log.pet_id
      and is_household_member(pets.household_id)
    )
);

drop policy if exists "Household members can insert logs" on activity_log;
create policy "Household members can insert logs"
on activity_log for insert
with check (
    exists (
      select 1 from pets
      where id = pet_id
      and is_household_member(pets.household_id)
    )
);
