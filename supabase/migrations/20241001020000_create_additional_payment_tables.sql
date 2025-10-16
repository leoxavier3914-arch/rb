create extension if not exists "pgcrypto";

create table public.refunded_sales (
  id uuid primary key default gen_random_uuid(),
  event_reference text not null unique,
  sale_id text,
  customer_name text,
  customer_email text,
  product_name text,
  amount numeric(12,2),
  currency text,
  payment_method text,
  occurred_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index refunded_sales_occurred_at_idx on public.refunded_sales (occurred_at desc nulls last, created_at desc);
create index refunded_sales_customer_email_idx on public.refunded_sales (customer_email);

create table public.rejected_payments (
  id uuid primary key default gen_random_uuid(),
  event_reference text not null unique,
  sale_id text,
  customer_name text,
  customer_email text,
  product_name text,
  amount numeric(12,2),
  currency text,
  payment_method text,
  occurred_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index rejected_payments_occurred_at_idx on public.rejected_payments (occurred_at desc nulls last, created_at desc);
create index rejected_payments_customer_email_idx on public.rejected_payments (customer_email);

create table public.pending_payments (
  id uuid primary key default gen_random_uuid(),
  event_reference text not null unique,
  sale_id text,
  customer_name text,
  customer_email text,
  product_name text,
  amount numeric(12,2),
  currency text,
  payment_method text,
  occurred_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index pending_payments_occurred_at_idx on public.pending_payments (occurred_at desc nulls last, created_at desc);
create index pending_payments_customer_email_idx on public.pending_payments (customer_email);
