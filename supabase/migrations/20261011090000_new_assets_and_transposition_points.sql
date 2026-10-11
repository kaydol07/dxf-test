-- New DXF assets are persisted separately from poles. Existing underground
-- routes remain readable for historical packages, but are no longer created
-- automatically by the viewer.

alter table public.dxf_elements
  drop constraint if exists dxf_elements_element_type_check;
alter table public.dxf_elements
  add constraint dxf_elements_element_type_check
  check (element_type in ('pole', 'box', 'lighting', 'transposition', 'underground_route', 'manual'));

alter table public.inspection_points
  drop constraint if exists inspection_points_point_type_check;
alter table public.inspection_points
  add constraint inspection_points_point_type_check
  check (point_type in ('pole', 'box', 'lighting', 'transposition', 'underground', 'manual'));
