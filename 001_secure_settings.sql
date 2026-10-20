-- Secure shared settings for CircuitTech Mine.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

-- No direct browser access to the admin allowlist.
revoke all on public.admin_users from anon, authenticated;

create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  settings jsonb not null default '{
    "clients": [
      {"id":"client1","name":"Client 1","channelEnv":"THINGSPEAK_CLIENT1"},
      {"id":"client2","name":"Client 2","channelEnv":"THINGSPEAK_CLIENT2"},
      {"id":"client3","name":"Client 3","channelEnv":"THINGSPEAK_CLIENT3"}
    ],
    "sensors": [
      {"id":"temperature","name":"Temperature","field":1,"unit":"°C","decimals":1},
      {"id":"humidity","name":"Humidity","field":2,"unit":"%","decimals":1},
      {"id":"gas","name":"MQ-135 gas","field":3,"unit":"raw","decimals":0},
      {"id":"distance","name":"Ultrasonic distance","field":4,"unit":"cm","decimals":1},
      {"id":"vibration","name":"Vibration","field":5,"unit":"raw","decimals":2},
      {"id":"rain","name":"Rain sensor","field":6,"unit":"raw","decimals":0},
      {"id":"soil","name":"Soil moisture","field":7,"unit":"raw","decimals":0},
      {"id":"tilt","name":"Tilt","field":8,"unit":"raw","decimals":2}
    ],
    "thresholds": {"temperature":45,"gas":1500,"distance":30,"vibration":2}
  }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;

-- Keep direct reads/writes blocked. Edge Functions use service role only after verifying JWT/admin membership.
drop policy if exists "admin users can read settings" on public.site_settings;
drop policy if exists "admin users can update settings" on public.site_settings;

insert into public.site_settings (id) values (true) on conflict (id) do nothing;
