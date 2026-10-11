-- AEDAŞ can manage all drawing projects. Contractors can manage only projects
-- explicitly tied to their own Yandex Disk folder. Field records stay BEDA-only.

drop policy if exists "BEDA manages projects" on public.projects;
drop policy if exists "Project managers create projects" on public.projects;
drop policy if exists "Project managers update projects" on public.projects;
drop policy if exists "Project managers delete projects" on public.projects;

create policy "Project managers create projects" on public.projects
  for insert to authenticated
  with check (
    public.current_app_role() in ('beda', 'aedas')
    or (
      public.current_app_role() = 'contractor'
      and yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
    )
  );

create policy "Project managers update projects" on public.projects
  for update to authenticated
  using (
    public.current_app_role() in ('beda', 'aedas')
    or (
      public.current_app_role() = 'contractor'
      and yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
    )
  )
  with check (
    public.current_app_role() in ('beda', 'aedas')
    or (
      public.current_app_role() = 'contractor'
      and yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
    )
  );

create policy "Project managers delete projects" on public.projects
  for delete to authenticated
  using (public.current_app_role() in ('beda', 'aedas'));

drop policy if exists "BEDA manages project files" on public.project_files;
drop policy if exists "Project managers create project files" on public.project_files;
drop policy if exists "Project managers update project files" on public.project_files;
drop policy if exists "Project managers delete project files" on public.project_files;

create policy "Project managers create project files" on public.project_files
  for insert to authenticated
  with check (
    public.current_app_role() in ('beda', 'aedas')
    or exists (
      select 1 from public.projects p
      where p.id = project_files.project_id
        and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
    )
  );

create policy "Project managers update project files" on public.project_files
  for update to authenticated
  using (
    public.current_app_role() in ('beda', 'aedas')
    or exists (
      select 1 from public.projects p
      where p.id = project_files.project_id
        and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
    )
  )
  with check (
    public.current_app_role() in ('beda', 'aedas')
    or exists (
      select 1 from public.projects p
      where p.id = project_files.project_id
        and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
    )
  );

create policy "Project managers delete project files" on public.project_files
  for delete to authenticated
  using (public.current_app_role() in ('beda', 'aedas'));

drop policy if exists "BEDA writes shared project files" on storage.objects;
drop policy if exists "Project managers insert project files" on storage.objects;
drop policy if exists "Project managers update project files" on storage.objects;
create policy "Project managers insert project files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and (
      public.current_app_role() in ('beda', 'aedas')
      or exists (
        select 1 from public.projects p
        where p.id = split_part(storage.objects.name, '/', 1)
          and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
      )
    )
  );

create policy "Project managers update project files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-files'
    and (
      public.current_app_role() in ('beda', 'aedas')
      or exists (
        select 1 from public.projects p
        where p.id = split_part(storage.objects.name, '/', 1)
          and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
      )
    )
  )
  with check (
    bucket_id = 'project-files'
    and (
      public.current_app_role() in ('beda', 'aedas')
      or exists (
        select 1 from public.projects p
        where p.id = split_part(storage.objects.name, '/', 1)
          and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
      )
    )
  );
