create table if not exists public.abandoned_email_updates (
  id text primary key,
  abandoned_email_id text not null references public.abandoned_emails(id) on delete cascade,
  checkout_id text,
  status text,
  source text,
  event text,
  snapshot jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abandoned_email_updates_abandoned_email_id_idx
  on public.abandoned_email_updates (abandoned_email_id);

create index if not exists abandoned_email_updates_checkout_id_idx
  on public.abandoned_email_updates (checkout_id);

create index if not exists abandoned_email_updates_occurred_at_idx
  on public.abandoned_email_updates (occurred_at);

create trigger set_timestamp_abandoned_email_updates
before update on public.abandoned_email_updates
for each row
execute procedure public.handle_updated_at();
