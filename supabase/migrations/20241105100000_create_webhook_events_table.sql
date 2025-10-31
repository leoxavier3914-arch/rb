create extension if not exists "pgcrypto";

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text null,
  trigger text null,
  status text null,
  source text null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz null,
  received_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists webhook_events_event_id_key on webhook_events(event_id);
create index if not exists webhook_events_trigger_idx on webhook_events(trigger);
create index if not exists webhook_events_received_at_idx on webhook_events(received_at desc);
