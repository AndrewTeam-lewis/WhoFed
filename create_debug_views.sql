-- View: debug_households_view
-- Shows households with owner details (email, name)
create or replace view debug_households_view as
select 
    h.id as household_id,
    h.owner_id,
    p.email as owner_email,
    p.first_name as owner_name,
    h.subscription_status
from households h
left join profiles p on h.owner_id = p.id;

-- View: debug_members_view
-- Shows members with their emails and household info
create or replace view debug_members_view as
select 
    hm.household_id,
    h.owner_id as household_owner_id,
    hm.user_id,
    p.email as user_email,
    p.first_name as user_name,
    hm.can_log,
    hm.can_edit,
    hm.is_active
from household_members hm
join households h on hm.household_id = h.id
left join profiles p on hm.user_id = p.id;
