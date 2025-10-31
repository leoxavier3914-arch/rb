create table if not exists webhook_settings (
  webhook_id text primary key,
  name text null,
  url text null,
  token text null,
  is_active boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table webhook_settings
  add constraint webhook_settings_webhook_id_check
  check (char_length(trim(coalesce(webhook_id, ''))) > 0);

create index if not exists webhook_settings_is_active_idx on webhook_settings(is_active);

alter table webhook_events
  add column if not exists webhook_token text;

create index if not exists webhook_events_webhook_token_idx on webhook_events(coalesce(webhook_token, ''));

