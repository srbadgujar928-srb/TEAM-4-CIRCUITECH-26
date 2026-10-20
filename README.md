# CircuitTech Mine — Secure Admin + Shared Backend

This version uses **Supabase Auth + PostgreSQL Row Level Security (RLS) + Edge Functions**. GitHub Pages serves the static UI; it does not store secrets or enforce permissions.

## What this provides
- Email/password administrator sign-in through Supabase Auth.
- Shared client/channel/field/threshold settings stored in Supabase Postgres.
- Database RLS: only the configured administrator can read/write settings.
- Edge Function `admin-settings` verifies the Supabase access token and checks the user's admin role before changing settings.
- Edge Function `client-data` reads ThingSpeak from the server side, so private ThingSpeak Read API keys are not shipped to the browser.
- Client 1/2/3 selector. The data endpoint exposes only the selected client's sensor readings. **Because the public dashboard has no client login, anyone can choose any client.** If client data must be confidential between clients, implement client authentication and server-side client-specific authorization before deployment.

## Services required
1. **GitHub Pages** — free static hosting.
2. **Supabase** — Auth, Postgres, RLS, and Edge Functions. Free tier may be enough for a class project; check current quotas/pricing.
3. **ThingSpeak** — one channel per client, plus an optional second channel for extra fields.

## Setup order
### A. Create Supabase project
1. Create a project at https://supabase.com/.
2. In Project Settings → API, copy the **Project URL** and **publishable/anon key**. These two values are intended for browser use. Never put a `service_role` key in the website.
3. In Authentication → Providers, enable Email. Turn off public sign-ups after creating the administrator account if the project settings allow it.
4. In Authentication → Users, create the admin user with your admin email/password.
5. Run the SQL in `supabase/migrations/001_secure_settings.sql` in the Supabase SQL Editor.
6. Copy the admin user's UUID from Authentication → Users and run:
   `insert into public.admin_users (user_id) values ('PASTE-ADMIN-USER-UUID');`
   Do this as a separate SQL command after the migration.

### B. Set backend secrets
In Supabase → Edge Functions → Secrets, set:
- `THINGSPEAK_CLIENT1_CHANNEL_ID`
- `THINGSPEAK_CLIENT1_READ_KEY` (blank only for public channel)
- `THINGSPEAK_CLIENT2_CHANNEL_ID`
- `THINGSPEAK_CLIENT2_READ_KEY`
- `THINGSPEAK_CLIENT3_CHANNEL_ID`
- `THINGSPEAK_CLIENT3_READ_KEY`

For any second channel used for acceleration, add it to the `channels` JSON in Admin Settings and set the corresponding server-side secrets; this starter version reads one channel per client. Keep all ThingSpeak keys server-side. Never use a Write API key for dashboard reading.

### C. Deploy Edge Functions
Install Supabase CLI, sign in, then from this folder:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-settings
supabase functions deploy client-data
```
Set the secrets in the Supabase dashboard (or `supabase secrets set ...`). Do not commit secret values to GitHub.

### D. Configure the frontend
Edit `app-config.js` and replace:
- `https://hleqgkfndjxckdoznjdp.supabase.co/rest/v1/`
- `sb_publishable_-0_hpxY9SfCKjFlJjv1woA_MhEhy9IL`

These are public client values. The anon/publishable key is safe only because RLS and Edge Function authorization are configured correctly.

### E. Publish on GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `admin.html`, `style.css`, `app-config.js`, `app.js`, and the `README.md` (plus `supabase/` folder for source control).
3. Settings → Pages → Deploy from branch → `main` → `/(root)` → Save.
4. Website: `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`
5. Admin: `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html`

## Security notes
- The admin page requires Supabase Auth and the backend independently verifies the access token and admin role. Hiding a button in JavaScript is not authorization; the Edge Function and RLS are the security boundary.
- Supabase `service_role` key and ThingSpeak Read/Write keys must never appear in frontend files.
- Use a strong, unique admin password and enable MFA in Supabase Auth if available for your plan.
- Restrict sign-ups and periodically review admin users.
- For genuinely isolated client access, public buttons are not enough. Add client login and a server-side client membership table / RLS policies; never rely on a client ID sent from the browser alone.
- The included public dashboard lets any visitor select any of the three clients by design. It must only be used for data you are comfortable exposing publicly.
- Set allowed redirect URLs in Supabase Auth URL Configuration to your GitHub Pages site and admin page.
- Configure CORS origins in the Edge Functions before production. This starter uses permissive CORS for easy setup; replace `*` with your exact GitHub Pages origin (e.g. `https://YOUR-USERNAME.github.io`) for production.
