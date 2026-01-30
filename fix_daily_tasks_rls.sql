-- Enable RLS for daily_tasks
alter table daily_tasks enable row level security;

-- Create policy to allow members to do EVERYTHING (SELECT, INSERT, UPDATE, DELETE)
-- as long as they belong to the associated household.
create policy "Household members can manage daily tasks"
on daily_tasks for all
using (
  public.is_household_member(household_id)
)
with check (
  public.is_household_member(household_id)
);
