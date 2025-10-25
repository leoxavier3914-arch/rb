create table if not exists app_state (
  id text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists app_events (
  id text primary key,
  payload jsonb not null,
  seen_at timestamptz not null default now()
);

create table if not exists kfy_products (
  id text primary key,
  title text,
  price_cents bigint,
  updated_at timestamptz,
  created_at timestamptz
);

create table if not exists kfy_sales (
  id text primary key,
  status text,
  customer_id text,
  total_amount_cents bigint,
  created_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz
);

create index if not exists kfy_sales_status_idx on kfy_sales(status);
create index if not exists kfy_sales_created_idx on kfy_sales(created_at);
create index if not exists kfy_sales_paid_idx on kfy_sales(paid_at);

