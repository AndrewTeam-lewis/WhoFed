-- COMPLETE RLS OVERHAUL TO FIX RECURSION V2

-- 1. Helper Function (Security Definer to bypass RLS)
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

-- 2. HOUSEHOLDS
drop policy if exists "Users can insert their own household" on households;
create policy "Users can insert their own household"
on households for insert
with check ( auth.uid() = owner_id );

drop policy if exists "Users can view households they belong to" on households;
drop policy if exists "Users can view households" on households;
create policy "Users can view households"
on households for select
using (
  auth.uid() = owner_id 
  or 
  is_household_member(id) -- Use the safe, non-recursive function
);

-- 3. HOUSEHOLD MEMBERS
drop policy if exists "Owners can add members" on household_members;
create policy "Owners can add members"
on household_members for insert
with check (
  exists (
    select 1 from households
    where id = household_id
    and owner_id = auth.uid()
  )
);

drop policy if exists "Members can view household members" on household_members;
create policy "Members can view household members"
on household_members for select
using (
  user_id = auth.uid() 
  or
  is_household_member(household_id)
);

drop policy if exists "Owners can update members" on household_members;
create policy "Owners can update members"
on household_members for update
using (
    exists (
    select 1 from households
    where id = household_id
    and owner_id = auth.uid()
  )
);

-- 4. PETS
drop policy if exists "Household members can manage pets" on pets;
create policy "Household members can manage pets"
on pets for all
using ( is_household_member(household_id) )
with check ( is_household_member(household_id) );

-- 5. SCHEDULES
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

-- 6. ACTIVITY LOG
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
