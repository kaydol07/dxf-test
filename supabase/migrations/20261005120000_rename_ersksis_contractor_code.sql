-- Correct the ERSKSİS contractor code to ERKSİS in profiles, records, and project paths.
-- Keep existing project IDs stable in app.js so their field records remain attached.

alter table public.user_profiles
  drop constraint if exists user_profiles_contractor_code_check;
alter table public.field_records
  drop constraint if exists field_records_assigned_contractor_check;

update public.user_profiles
set contractor_code = 'ERKSİS'
where contractor_code = 'ERSKSİS';

update public.field_records
set assigned_contractor = 'ERKSİS'
where assigned_contractor = 'ERSKSİS';

update public.projects
set yandex_path = 'disk:/PROJELER/ERKSİS'
where yandex_path = 'disk:/PROJELER/ERSKSİS';

alter table public.user_profiles
  add constraint user_profiles_contractor_code_check
  check (contractor_code in ('ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM'));
alter table public.field_records
  add constraint field_records_assigned_contractor_check
  check (assigned_contractor in ('ERKSİS', 'ASTAN', 'ASMİN', 'ERBU', 'AZRAM'));
