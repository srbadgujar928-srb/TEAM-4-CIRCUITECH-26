-- Expose only the non-secret settings needed to render sensor cards.
-- The settings JSON must never contain ThingSpeak keys or other secrets.
create or replace view public.public_site_settings as
select id,
       jsonb_build_object(
         'clients', coalesce(settings->'clients', '[]'::jsonb),
         'sensors', coalesce(settings->'sensors', '[]'::jsonb),
         'thresholds', coalesce(settings->'thresholds', '{}'::jsonb)
       ) as settings
from public.site_settings;

-- Permit anonymous read of this safe view only; underlying table remains denied by grants/RLS.
grant select on public.public_site_settings to anon, authenticated;
