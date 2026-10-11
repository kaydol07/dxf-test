-- Quality control records are visible to every user who can see the project.
-- Only BEDA keeps insert/update/delete policies from the earlier migrations.

drop policy if exists "BEDA only reads field records" on public.field_records;
drop policy if exists "Users read field records for visible projects" on public.field_records;
create policy "Users read field records for visible projects" on public.field_records
  for select to authenticated
  using (
    public.current_app_role() in ('beda', 'aedas')
    or (
      public.current_app_role() = 'contractor'
      and exists (
        select 1 from public.projects p
        where p.id = field_records.project_id
          and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
      )
    )
  );

drop policy if exists "Users read safe drawings for visible projects" on public.project_files;
create policy "Users read safe drawings for visible projects" on public.project_files
  for select to authenticated
  using (
    lower(file_name) ~ '\\.(dxf|dxfproj|zip|kml|kmz)$'
    and exists (select 1 from public.projects p where p.id = project_files.project_id)
    and (
      public.current_app_role() in ('beda', 'aedas')
      or (
        public.current_app_role() = 'contractor'
        and exists (
          select 1 from public.projects p
          where p.id = project_files.project_id
            and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
        )
      )
    )
  );

drop policy if exists "Users read safe drawings for visible projects" on storage.objects;
create policy "Users read safe drawings for visible projects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and lower(storage.objects.name) ~ '\\.(dxf|dxfproj|zip|kml|kmz)$'
    and exists (
      select 1 from public.projects p
      where p.id = split_part(storage.objects.name, '/', 1)
        and (
          public.current_app_role() in ('beda', 'aedas')
          or (
            public.current_app_role() = 'contractor'
            and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
          )
        )
    )
  );

drop policy if exists "BEDA alone reads field photos" on storage.objects;
create policy "Users read photos for visible field records" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'field-photos'
    and exists (
      select 1 from public.field_records r
      join public.projects p on p.id = r.project_id
      where r.id::text = split_part(storage.objects.name, '/', 2)
        and r.photo_path = storage.objects.name
        and (
          public.current_app_role() in ('beda', 'aedas')
          or (
            public.current_app_role() = 'contractor'
            and p.yandex_path = 'disk:/PROJELER/' || public.current_contractor_code()
          )
        )
    )
  );
