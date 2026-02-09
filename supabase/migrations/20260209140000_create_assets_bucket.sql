-- Create a public bucket for assets
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Set up access policies
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'assets' );

create policy "Authenticated Upload"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'assets' );
