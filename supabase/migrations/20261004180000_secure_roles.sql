-- Shared project storage and server-enforced BEDA / AEDAŞ / contractor permissions.
-- Apply only after creating the Supabase project. No passwords or API secrets belong here.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('beda', 'aedas', 'contractor')),
  contractor_code text check (contractor_code in ('ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM')),
  created_at timestamptz not null default now(),
  constraint contractor_identity_matches_role check (
    (role = 'contractor' and contractor_code is not null)
    or (role <> 'contractor' and contractor_code is null)
  )
);

create table if not exists public.projects (
  id text primary key,
  name text not null,
  yandex_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  source_path text,
  mime_type text,
  file_size bigint,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.field_records (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  category text not null default 'Diğer',
  status text check (status in ('problem', 'pending', 'suitable')),
  assigned_contractor text check (assigned_contractor in ('ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM')),
  notes text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  photo_path text,
  photo_name text,
  photo_type text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists field_records_project_idx on public.field_records(project_id, created_at desc);
create index if not exists field_records_contractor_idx on public.field_records(assigned_contractor);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.user_profiles p where p.user_id = (select auth.uid()) limit 1;
$$;

create or replace function public.current_contractor_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.contractor_code from public.user_profiles p where p.user_id = (select auth.uid()) limit 1;
$$;

revoke all on function public.current_app_role() from public, anon;
revoke all on function public.current_contractor_code() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_contractor_code() to authenticated;

alter table public.user_profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.field_records enable row level security;

revoke all on public.user_profiles, public.projects, public.project_files, public.field_records from anon;
revoke insert, update, delete on public.user_profiles from authenticated;
grant select on public.user_profiles, public.projects, public.project_files, public.field_records to authenticated;
grant insert, update, delete on public.projects, public.project_files, public.field_records to authenticated;

drop policy if exists "Users read their own profile; BEDA reads all" on public.user_profiles;
create policy "Users read their own profile; BEDA reads all" on public.user_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.current_app_role() = 'beda');

drop policy if exists "Authenticated users read projects" on public.projects;
create policy "Users read projects they are allowed to see" on public.projects
  for select to authenticated
  using (
    public.current_app_role() in ('beda', 'aedas')
    or (public.current_app_role() = 'contractor' and exists (
      select 1 from public.field_records r
      where r.project_id = projects.id and r.assigned_contractor = public.current_contractor_code()
    ))
  );
drop policy if exists "BEDA manages projects" on public.projects;
create policy "BEDA manages projects" on public.projects
  for all to authenticated
  using (public.current_app_role() = 'beda')
  with check (public.current_app_role() = 'beda');

drop policy if exists "Authenticated users read project files" on public.project_files;
create policy "Users read files for projects they can see" on public.project_files
  for select to authenticated using (
    exists (select 1 from public.projects p where p.id = project_files.project_id)
  );
drop policy if exists "BEDA manages project files" on public.project_files;
create policy "BEDA manages project files" on public.project_files
  for all to authenticated
  using (public.current_app_role() = 'beda')
  with check (public.current_app_role() = 'beda');

drop policy if exists "BEDA and AEDAŞ read all; contractors read assigned records" on public.field_records;
create policy "BEDA and AEDAŞ read all; contractors read assigned records" on public.field_records
  for select to authenticated
  using (
    public.current_app_role() in ('beda', 'aedas')
    or (public.current_app_role() = 'contractor' and assigned_contractor = public.current_contractor_code())
  );
drop policy if exists "BEDA creates field records" on public.field_records;
create policy "BEDA creates field records" on public.field_records
  for insert to authenticated
  with check (public.current_app_role() = 'beda' and created_by = (select auth.uid()));
drop policy if exists "BEDA updates field records" on public.field_records;
create policy "BEDA updates field records" on public.field_records
  for update to authenticated
  using (public.current_app_role() = 'beda')
  with check (public.current_app_role() = 'beda');
drop policy if exists "BEDA deletes field records" on public.field_records;
create policy "BEDA deletes field records" on public.field_records
  for delete to authenticated
  using (public.current_app_role() = 'beda');

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false), ('field-photos', 'field-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Signed-in users read shared project files" on storage.objects;
create policy "Signed-in users read shared project files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and exists (select 1 from public.projects p where p.id = split_part(storage.objects.name, '/', 1))
  );
drop policy if exists "BEDA writes shared project files" on storage.objects;
create policy "BEDA writes shared project files" on storage.objects
  for all to authenticated
  using (bucket_id = 'project-files' and public.current_app_role() = 'beda')
  with check (bucket_id = 'project-files' and public.current_app_role() = 'beda');

drop policy if exists "Users read photos for visible records" on storage.objects;
create policy "Users read photos for visible records" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'field-photos'
    and exists (
      select 1 from public.field_records r
      where r.id::text = split_part(storage.objects.name, '/', 2)
        and r.photo_path = storage.objects.name
    )
  );
drop policy if exists "BEDA writes field photos" on storage.objects;
create policy "BEDA writes field photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'field-photos' and public.current_app_role() = 'beda')
  with check (bucket_id = 'field-photos' and public.current_app_role() = 'beda');
