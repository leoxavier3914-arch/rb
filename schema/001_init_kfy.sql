create table if not exists kfy_products (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  title text not null,
  description text,
  image_url text,
  price_cents bigint not null default 0,
  currency text not null default 'BRL',
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_customers (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  name text not null,
  email text not null,
  phone text,
  country text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_orders (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  product_id bigint not null references kfy_products(id) on delete cascade,
  customer_id bigint not null references kfy_customers(id) on delete cascade,
  status text not null,
  payment_method text not null,
  gross_cents bigint not null default 0,
  fee_cents bigint not null default 0,
  net_cents bigint not null default 0,
  commission_cents bigint not null default 0,
  currency text not null default 'BRL',
  approved_at timestamptz,
  refunded_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_refunds (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  order_id bigint not null references kfy_orders(id) on delete cascade,
  reason text,
  amount_cents bigint not null default 0,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_enrollments (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  customer_id bigint not null references kfy_customers(id) on delete cascade,
  product_id bigint not null references kfy_products(id) on delete cascade,
  status text not null,
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_coupons (
  id bigint generated always as identity primary key,
  external_id text not null unique,
  code text not null,
  type text not null,
  value_cents_or_percent numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  external_id text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  constraint kfy_events_unique_event unique (type, external_id)
);

create index if not exists idx_kfy_orders_created_status on kfy_orders (created_at desc, status);
create index if not exists idx_kfy_orders_approved_at on kfy_orders (approved_at desc);
create index if not exists idx_kfy_orders_customer on kfy_orders (customer_id);
create index if not exists idx_kfy_orders_product on kfy_orders (product_id);

create index if not exists idx_kfy_products_status on kfy_products (status, created_at desc);
create index if not exists idx_kfy_customers_email on kfy_customers (email);
create index if not exists idx_kfy_refunds_created_status on kfy_refunds (created_at desc, status);
create index if not exists idx_kfy_enrollments_customer on kfy_enrollments (customer_id, status);
create index if not exists idx_kfy_enrollments_product on kfy_enrollments (product_id, status);
