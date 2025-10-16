create extension if not exists "pgcrypto";

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  event_reference text not null unique,
  subscription_id text,
  sale_id text,
  customer_name text,
  customer_email text,
  product_name text,
  amount numeric(12,2),
  currency text,
  payment_method text,
  event_type text,
  subscription_status text,
  occurred_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index subscription_events_occurred_at_idx
  on public.subscription_events (occurred_at desc nulls last, created_at desc);
create index subscription_events_customer_email_idx
  on public.subscription_events (customer_email);
create index subscription_events_subscription_id_idx
  on public.subscription_events (subscription_id);
