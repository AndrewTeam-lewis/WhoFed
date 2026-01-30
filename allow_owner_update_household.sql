-- Allow owners to update their own household (e.g. for Subscription Status)
drop policy if exists "Owners can update their own household" on households;

create policy "Owners can update their own household"
on households for update
using ( auth.uid() = owner_id )
with check ( auth.uid() = owner_id );
