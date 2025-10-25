create table if not exists app_state (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists app_events (
  id text primary key,
  source text default 'kiwify',
  type text,
  status text default 'processed',
  error text,
  payload jsonb not null,
  seen_at timestamptz not null default now()
);

create table if not exists kfy_products (
  id text primary key,
  title text,
  price_cents bigint,
  currency text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb default '{}'::jsonb
);
create index if not exists kfy_products_created_idx on kfy_products(created_at);

create table if not exists kfy_customers (
  id text primary key,
  name text,
  email text,
  phone text,
  country text,
  state text,
  city text,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb default '{}'::jsonb
);
create index if not exists kfy_customers_email_idx on kfy_customers(email);
create index if not exists kfy_customers_email_lower_idx on kfy_customers (lower(email));
create index if not exists kfy_customers_state_idx on kfy_customers(state);

create table if not exists kfy_sales (
  id text primary key,
  status text,
  product_id text,
  customer_id text,
  total_amount_cents bigint,
  fee_amount_cents bigint,
  net_amount_cents bigint,
  currency text,
  created_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz,
  raw jsonb default '{}'::jsonb
);
create index if not exists kfy_sales_status_idx  on kfy_sales(status);
create index if not exists kfy_sales_created_idx on kfy_sales(created_at);
create index if not exists kfy_sales_paid_idx    on kfy_sales(paid_at);
create index if not exists kfy_sales_product_idx on kfy_sales(product_id);

create table if not exists kfy_subscriptions (
  id text primary key,
  customer_id text,
  product_id text,
  status text,
  started_at timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz,
  raw jsonb default '{}'::jsonb
);
create index if not exists kfy_subscriptions_status_idx on kfy_subscriptions(status);

create table if not exists kfy_enrollments (
  id text primary key,
  customer_id text,
  course_id text,
  status text,
  progress numeric,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_coupons (
  id text primary key,
  code text,
  percent_off numeric,
  amount_off_cents bigint,
  currency text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_refunds (
  id text primary key,
  sale_id text,
  amount_cents bigint,
  reason text,
  created_at timestamptz,
  raw jsonb default '{}'::jsonb
);

create table if not exists kfy_payouts (
  id text primary key,
  amount_cents bigint,
  currency text,
  status text,
  scheduled_for timestamptz,
  paid_at timestamptz,
  created_at timestamptz,
  raw jsonb default '{}'::jsonb
);
create index if not exists kfy_payouts_status_idx on kfy_payouts(status);

create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  name text not null,
  params jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists kfy_sale_events (
  id uuid primary key default gen_random_uuid(),
  sale_id text not null,
  type text not null,
  at timestamptz not null,
  meta jsonb default '{}'::jsonb
);
create index if not exists kfy_sale_events_sale_idx on kfy_sale_events(sale_id, at);

create table if not exists app_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  body text not null,
  author text,
  created_at timestamptz default now()
);
create index if not exists app_notes_ent_idx on app_notes(entity_type, entity_id, created_at desc);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  resource text not null,
  status text not null,
  params jsonb,
  result_url text,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists entity_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  version int not null,
  data jsonb not null,
  changed_at timestamptz not null default now()
);
create unique index if not exists entity_versions_unique on entity_versions(entity_type, entity_id, version);
create index if not exists entity_versions_changed_idx on entity_versions(changed_at);
