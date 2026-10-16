-- Previews are optional. Existing photos continue to use storage_path until a
-- thumbnail is available, so packages and historic inspection records remain
-- compatible.
alter table public.inspection_attachments
  add column if not exists preview_path text;

alter table public.inspection_results
  drop constraint if exists inspection_results_completion_status_check;
alter table public.inspection_results
  add constraint inspection_results_completion_status_check
  check (completion_status in ('NOT_DONE', 'DONE', 'PARTIAL'));

alter table public.dxf_elements
  drop constraint if exists dxf_elements_element_type_check;
alter table public.dxf_elements
  add constraint dxf_elements_element_type_check
  check (element_type in ('pole', 'box', 'lighting', 'sdk', 'transposition', 'underground', 'underground_route', 'manual'));

comment on column public.inspection_attachments.preview_path is
  'Optional compressed preview stored in the same protected inspection-photos bucket.';
