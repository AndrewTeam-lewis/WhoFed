-- Enable RLS (if not already enabled, confirming safety)
alter table households enable row level security;
alter table household_members enable row level security;
alter table pets enable row level security;
alter table activity_log enable row level security;

-- HOUSEHOLDS
-- 1. Allow users to insert a household if they are the owner
create policy "Users can insert their own household"
on households for insert
with check ( auth.uid() = owner_id );

-- 2. Allow users to see households they own or are members of
create policy "Users can view households they belong to"
on households for select
using (
  auth.uid() = owner_id 
  or 
  exists (
    select 1 from household_members
    where household_id = households.id
    and user_id = auth.uid()
  )
);

-- HOUSEHOLD MEMBERS
-- 1. Allow owners to add members (including themselves)
create policy "Owners can add members"
on household_members for insert
with check (
  exists (
    select 1 from households
    where id = household_id
    and owner_id = auth.uid()
  )
);

-- 2. Allow members to view other members in the same household
create policy "Members can view household members"
on household_members for select
using (
  exists (
    select 1 from household_members as hm
    where hm.household_id = household_members.household_id
    and hm.user_id = auth.uid()
  )
);

-- PETS
-- 1. Allow view/edit/insert if user is member of household
create policy "Household members can manage pets"
on pets for all
using (
  exists (
    select 1 from household_members
    where household_id = pets.household_id
    and user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from household_members
    where household_id = household_id
    and user_id = auth.uid()
  )
);

-- SCHEDULES
alter table schedules enable row level security;

create policy "Household members can manage schedules"
on schedules for all
using (
  exists (
    select 1 from pets
    join household_members on household_members.household_id = pets.household_id
    where pets.id = schedules.pet_id
    and household_members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from pets
    join household_members on household_members.household_id = pets.household_id
    where pets.id = pet_id
    and household_members.user_id = auth.uid()
  )
);

-- ACTIVITY LOG
create policy "Household members can view logs"
on activity_log for select
using (
  exists (
    select 1 from pets
    join household_members on household_members.household_id = pets.household_id
    where pets.id = activity_log.pet_id
    and household_members.user_id = auth.uid()
  )
);

create policy "Household members can insert logs"
on activity_log for insert
with check (
  exists (
    select 1 from pets
    join household_members on household_members.household_id = pets.household_id
    where pets.id = pet_id
    and household_members.user_id = auth.uid()
  )
);
