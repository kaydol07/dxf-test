-- Persistent project identities and the electrical field-inspection domain.
-- This migration is additive: existing projects and field_records remain valid.

alter table public.projects
  add column if not exists canonical_key text,
  add column if not exists contractor_code text check (contractor_code in ('ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM')),
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists package_storage_path text,
  add column if not exists package_updated_at timestamptz;

-- Preserve existing data while making the Yandex folder the source of the
-- automatic contractor assignment for legacy projects.
update public.projects
set contractor_code = regexp_replace(yandex_path, '^disk:/PROJELER/', '')
where contractor_code is null
  and yandex_path ~ '^disk:/PROJELER/(ERKSİS|ASTAN|ASMİN|ERBU|AZRAM)$';

create unique index if not exists projects_canonical_key_unique
  on public.projects(canonical_key) where canonical_key is not null;
create index if not exists projects_contractor_code_idx on public.projects(contractor_code);

-- Security-definer helper prevents RLS recursion and applies the same
-- project-level decision to every inspection child table.
create or replace function public.can_access_project(target_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project_id
      and (
        public.current_app_role() in ('beda', 'aedas')
        or (
          public.current_app_role() = 'contractor'
          and p.contractor_code = public.current_contractor_code()
        )
      )
  );
$$;

revoke all on function public.can_access_project(text) from public, anon;
grant execute on function public.can_access_project(text) to authenticated;

create table if not exists public.dxf_elements (
  project_id text not null references public.projects(id) on delete cascade,
  element_id text not null,
  element_type text not null check (element_type in ('pole', 'underground_route', 'manual')),
  source_layer text,
  source_handle text,
  label text,
  pole_type text,
  network_role text,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, element_id)
);

create table if not exists public.inspection_points (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  element_id text,
  point_type text not null check (point_type in ('pole', 'underground', 'manual')),
  offset_meters double precision,
  label text,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, element_id, point_type)
);

create table if not exists public.inspection_results (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  inspection_point_id text not null references public.inspection_points(id) on delete cascade,
  element_id text,
  checklist_id text not null,
  checklist_item_id text not null,
  completion_status text not null check (completion_status in ('NOT_DONE', 'DONE')),
  quality_status text not null check (quality_status in ('NOT_CHECKED', 'COMPLIANT', 'NON_COMPLIANT')),
  note text not null default '',
  reference_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(project_id, inspection_point_id, checklist_item_id)
);

create table if not exists public.nonconformities (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  inspection_point_id text references public.inspection_points(id) on delete set null,
  element_id text,
  checklist_item_id text,
  contractor_code text check (contractor_code in ('ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM')),
  description text not null,
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  state text not null default 'active' check (state in ('active', 'correction_pending', 'closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  closed_by uuid references auth.users(id),
  closed_at timestamptz
);

create table if not exists public.nonconformity_events (
  id uuid primary key default gen_random_uuid(),
  nonconformity_id uuid not null references public.nonconformities(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'correction_requested', 'closed', 'reopened', 'updated')),
  note text not null default '',
  previous_state text,
  next_state text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.inspection_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  nonconformity_id uuid references public.nonconformities(id) on delete cascade,
  inspection_result_id uuid references public.inspection_results(id) on delete cascade,
  stage text not null check (stage in ('before', 'after', 'general')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint attachment_parent_exists check (nonconformity_id is not null or inspection_result_id is not null)
);

create index if not exists dxf_elements_project_type_idx on public.dxf_elements(project_id, element_type);
create index if not exists inspection_points_project_idx on public.inspection_points(project_id, point_type);
create index if not exists inspection_results_project_idx on public.inspection_results(project_id, checklist_item_id);
create index if not exists nonconformities_project_state_idx on public.nonconformities(project_id, state, updated_at desc);
create index if not exists nonconformity_events_nonconformity_idx on public.nonconformity_events(nonconformity_id, created_at);
create index if not exists inspection_attachments_nonconformity_idx on public.inspection_attachments(nonconformity_id, created_at);

alter table public.dxf_elements enable row level security;
alter table public.inspection_points enable row level security;
alter table public.inspection_results enable row level security;
alter table public.nonconformities enable row level security;
alter table public.nonconformity_events enable row level security;
alter table public.inspection_attachments enable row level security;

revoke all on public.dxf_elements, public.inspection_points, public.inspection_results,
  public.nonconformities, public.nonconformity_events, public.inspection_attachments from anon;
grant select, insert, update, delete on public.dxf_elements, public.inspection_points,
  public.inspection_results, public.nonconformities, public.nonconformity_events,
  public.inspection_attachments to authenticated;

drop policy if exists "Project users read DXF elements" on public.dxf_elements;
create policy "Project users read DXF elements" on public.dxf_elements for select to authenticated
  using (public.can_access_project(project_id));
drop policy if exists "BEDA manages DXF elements" on public.dxf_elements;
create policy "BEDA manages DXF elements" on public.dxf_elements for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

drop policy if exists "Project users read inspection points" on public.inspection_points;
create policy "Project users read inspection points" on public.inspection_points for select to authenticated
  using (public.can_access_project(project_id));
drop policy if exists "BEDA manages inspection points" on public.inspection_points;
create policy "BEDA manages inspection points" on public.inspection_points for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

drop policy if exists "Project users read inspection results" on public.inspection_results;
create policy "Project users read inspection results" on public.inspection_results for select to authenticated
  using (public.can_access_project(project_id));
drop policy if exists "BEDA manages inspection results" on public.inspection_results;
create policy "BEDA manages inspection results" on public.inspection_results for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

drop policy if exists "Project users read nonconformities" on public.nonconformities;
create policy "Project users read nonconformities" on public.nonconformities for select to authenticated
  using (public.can_access_project(project_id));
drop policy if exists "BEDA manages nonconformities" on public.nonconformities;
create policy "BEDA manages nonconformities" on public.nonconformities for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

drop policy if exists "Project users read nonconformity events" on public.nonconformity_events;
create policy "Project users read nonconformity events" on public.nonconformity_events for select to authenticated
  using (public.can_access_project(project_id));
drop policy if exists "BEDA manages nonconformity events" on public.nonconformity_events;
create policy "BEDA manages nonconformity events" on public.nonconformity_events for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

drop policy if exists "Project users read inspection attachments" on public.inspection_attachments;
create policy "Project users read inspection attachments" on public.inspection_attachments for select to authenticated
  using (public.can_access_project(project_id));
drop policy if exists "BEDA manages inspection attachments" on public.inspection_attachments;
create policy "BEDA manages inspection attachments" on public.inspection_attachments for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Project users read inspection photos" on storage.objects;
create policy "Project users read inspection photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'inspection-photos'
    and public.can_access_project(split_part(storage.objects.name, '/', 1))
  );
drop policy if exists "BEDA writes inspection photos" on storage.objects;
create policy "BEDA writes inspection photos" on storage.objects for all to authenticated
  using (bucket_id = 'inspection-photos' and public.current_app_role() = 'beda')
  with check (bucket_id = 'inspection-photos' and public.current_app_role() = 'beda');

-- The operational roles are read-only.  Earlier prototype migrations allowed
-- project uploads for contractors/AEDAŞ; replace those policies at the data
-- layer instead of merely hiding a browser button.
drop policy if exists "Project managers create projects" on public.projects;
drop policy if exists "Project managers update projects" on public.projects;
drop policy if exists "Project managers delete projects" on public.projects;
drop policy if exists "BEDA manages projects" on public.projects;
create policy "BEDA manages projects" on public.projects for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

drop policy if exists "Project managers create project files" on public.project_files;
drop policy if exists "Project managers update project files" on public.project_files;
drop policy if exists "Project managers delete project files" on public.project_files;
drop policy if exists "BEDA manages project files" on public.project_files;
create policy "BEDA manages project files" on public.project_files for all to authenticated
  using (public.current_app_role() = 'beda') with check (public.current_app_role() = 'beda');

drop policy if exists "Project managers insert project files" on storage.objects;
drop policy if exists "Project managers update project files" on storage.objects;
drop policy if exists "BEDA writes shared project files" on storage.objects;
create policy "BEDA writes shared project files" on storage.objects for all to authenticated
  using (bucket_id = 'project-files' and public.current_app_role() = 'beda')
  with check (bucket_id = 'project-files' and public.current_app_role() = 'beda');
