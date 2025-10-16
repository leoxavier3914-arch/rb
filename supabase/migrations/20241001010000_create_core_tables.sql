create extension if not exists "pgcrypto";

create table public.approved_sales (
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

create index approved_sales_occurred_at_idx on public.approved_sales (occurred_at desc nulls last, created_at desc);
create index approved_sales_customer_email_idx on public.approved_sales (customer_email);

create table public.abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  event_reference text not null unique,
  cart_id text,
  customer_name text,
  customer_email text,
  product_name text,
  amount numeric(12,2),
  currency text,
  checkout_url text,
  status text,
  occurred_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index abandoned_carts_occurred_at_idx on public.abandoned_carts (occurred_at desc nulls last, created_at desc);
create index abandoned_carts_customer_email_idx on public.abandoned_carts (customer_email);
