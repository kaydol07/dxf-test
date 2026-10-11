-- BEDA alone can view field records. Other roles see drawings only, with
-- contractor project access scoped to that contractor's Yandex Disk folder.

drop policy if exists "Users read projects they are allowed to see" on public.projects;
create policy "Users read projects they are allowed to see" on public.projects
  for select to authenticated
  using (
    public.current_app_role() in ('beda', 'aedas')
    or (
      public.current_app_role() = 'contractor'
      and yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
    )
  );

drop policy if exists "BEDA and AEDAŞ read all; contractors read assigned records" on public.field_records;
drop policy if exists "BEDA only reads field records" on public.field_records;
create policy "BEDA only reads field records" on public.field_records
  for select to authenticated
  using (public.current_app_role() = 'beda');

drop policy if exists "Users read files for projects they can see" on public.project_files;
drop policy if exists "Users read safe drawings for visible projects" on public.project_files;
create policy "Users read safe drawings for visible projects" on public.project_files
  for select to authenticated
  using (
    public.current_app_role() = 'beda'
    or (
      public.current_app_role() in ('aedas', 'contractor')
      and lower(file_name) ~ '\.(dxf|kml|kmz)$'
      and exists (select 1 from public.projects p where p.id = project_files.project_id)
    )
  );

drop policy if exists "Signed-in users read shared project files" on storage.objects;
drop policy if exists "Users read safe drawings for visible projects" on storage.objects;
create policy "Users read safe drawings for visible projects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and (
      public.current_app_role() = 'beda'
      or (
        lower(storage.objects.name) ~ '\.(dxf|kml|kmz)$'
        and exists (
          select 1 from public.projects p
          where p.id = split_part(storage.objects.name, '/', 1)
        )
      )
    )
  );

drop policy if exists "Users read photos for visible records" on storage.objects;
drop policy if exists "BEDA alone reads field photos" on storage.objects;
create policy "BEDA alone reads field photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'field-photos'
    and public.current_app_role() = 'beda'
    and exists (
      select 1 from public.field_records r
      where r.id::text = split_part(storage.objects.name, '/', 2)
        and r.photo_path = storage.objects.name
    )
  );
