# Shared projects and Yandex Disk setup

This app is currently a static local prototype. The SQL and Edge Function here define the server-side pieces required for real BEDA, AEDAŞ, and contractor accounts. The profile picker in the current site is only a demonstration and must not be treated as authentication.

## Permissions implemented in the schema

- BEDA can read, create, update, and delete field records, inspection results, nonconformities, audit events and attached photos.
- AEDAŞ can read every project's drawings, project packages, inspection results and nonconformities, but cannot change them.
- Each contractor can list and open only the package, drawing and inspection data in `/PROJELER/<TAŞERON_ADI>`; another contractor's rows are blocked by RLS.
- Only BEDA writes DXF files, packages and inspection data. This rule is enforced by database and storage policies, not only browser controls.
- User roles are stored in `user_profiles`; signed-in users cannot edit their own role.

## Required account setup

1. Create a Supabase project and run all SQL migration files in filename order in its SQL editor.
2. Disable public sign-up in Supabase Auth, then create the seven accounts (BEDA, AEDAŞ, ERKSİS, ASTAN, ASMİN, ERBU, AZRAM). The visible site login is only **kullanıcı adı + şifre**. In the Supabase dashboard, create each user with its generated internal email: `beda@accounts.dxf.local`, `aedas@accounts.dxf.local`, `erksis@accounts.dxf.local`, `astan@accounts.dxf.local`, `asmin@accounts.dxf.local`, `erbu@accounts.dxf.local`, and `azram@accounts.dxf.local`. No real mailbox is needed; give each user its own password and disable email confirmation for these locally managed accounts.
3. Add each created Auth user's UUID to `public.user_profiles` using the SQL editor. Set roles to `beda`, `aedas`, or `contractor`, and set the matching contractor code for the five contractor accounts. BEDA and AEDAŞ can upload drawing files to the shared project area; a contractor upload is attached to only its own `/PROJELER/<TAŞERON>` folder. Saha kayıtları and their photos stay BEDA-only.
4. In Supabase Edge Function secrets, set `YANDEX_DISK_OAUTH_TOKEN` after authorizing the Yandex Disk API for the account that owns `PROJELER`, with `cloud_api:disk.read` and `cloud_api:disk.write`. The write scope is used only when BEDA presses **Güncel paketi Yandex'e kaydet**. Set `APP_ALLOWED_ORIGINS` to the exact development and published site origins.
5. Deploy the `yandex-projects` and `manage-contractor-password` functions. The password function uses the server-only `SUPABASE_SERVICE_ROLE_KEY` already available to Supabase Edge Functions; never add that key to browser code. Only a signed-in BEDA profile can reset a contractor password.
6. BEDA can check that `/PROJELER/ERKSİS`, `/PROJELER/ASTAN`, `/PROJELER/ASMİN`, `/PROJELER/ERBU`, and `/PROJELER/AZRAM` exist, and can write a versioned package into the matching folder. BEDA and AEDAŞ can list all drawing folders; each contractor can list and download only its own folder and its own packages.
7. Put the Supabase project URL and **publishable** key in the app's public configuration. Never put a Supabase secret/service key or the Yandex token in browser code.

## Yandex folder permissions by contractor

Keep `/PROJELER` private and do not share it with contractor accounts. After BEDA creates the five subfolders, use Yandex Disk in a desktop browser to share each subfolder separately with only the matching contractor's Yandex account:

| Yandex folder | Invite only this contractor | Permission |
| --- | --- | --- |
| `/PROJELER/ERKSİS` | ERKSİS account | View |
| `/PROJELER/ASTAN` | ASTAN account | View |
| `/PROJELER/ASMİN` | ASMİN account | View |
| `/PROJELER/ERBU` | ERBU account | View |
| `/PROJELER/AZRAM` | AZRAM account | View |

Use **Manage access / Share → Add user → View** for each folder, and do not create a public link. View access preserves the rule that only BEDA can make corrections. Keep the matching Yandex account identity and Supabase contractor profile aligned. Yandex folder invitations are configured in Disk; the app's role checks and database row-level security separately limit what each signed-in user can load. Do not share the parent folder, since that would expose every contractor subfolder. Yandex documents folder invitations and per-person View/Edit access in its [shared-folder guide](https://www.yandex.com/support/yandex-360/customers/disk/web/en/share/shared-folders).

If `/PROJELER/ERSKSİS` already exists from an earlier setup, move its drawing files into `/PROJELER/ERKSİS` and invite the ERKSİS account to the renamed folder; the app uses only the corrected name.

The Yandex URL supplied in chat identifies the Disk folder, but the app cannot read a private folder from its URL alone. The folder must be authorized through Yandex OAuth. Move each DXF into its matching contractor folder in Yandex; folders are created by the app, but files are not moved automatically. A single-DXF project takes its display name from the DXF filename without `.dxf`.

The password previously shared for BEDA is not used by this setup; set a new one in Supabase Auth after rotating the exposed password.

## Inspection migration

Apply `20261006130000_inspection_domain_and_stable_projects.sql` after the earlier migrations. It adds:

- stable `projects.canonical_key` values used to match the same raw DXF across local and Yandex opening;
- automatic `projects.contractor_code`, initially derived from the existing Yandex path;
- DXF elements, inspection points, checklist results, nonconformities, audit events and before/after attachments;
- RLS policies that let AEDAŞ/contractors read only permitted project data while only BEDA writes it.

Existing `field_records`, packages with `schemaVersion: 1`, and the old `ERSKSİS` folder spelling remain readable. When an old DXF is next opened and saved by BEDA, its content fingerprint is added as `canonical_key`; later local or Yandex opens resolve to that existing project id.

## Current setup state

The `dxf-saha` Supabase project has been created, its schema and row-level security rules have been applied, and the `yandex-projects` Edge Function has been deployed. The Supabase URL and public publishable key are configured in `supabase-config.js` in this working copy. The function needs `YANDEX_DISK_OAUTH_TOKEN`; create Auth users, assign their profiles, then apply every migration in filename order. The changed app files need to be published to GitHub Pages before the public site uses this backend.
