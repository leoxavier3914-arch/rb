create table if not exists sales (
  id text primary key,
  status text,
  product_id text,
  product_title text,
  customer_id text,
  customer_name text,
  customer_email text,
  total_amount_cents bigint,
  net_amount_cents bigint,
  fee_amount_cents bigint,
  currency text default 'BRL',
  installments integer,
  created_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz not null default timezone('utc', now()),
  raw jsonb not null default '{}'::jsonb
);

create index if not exists sales_created_idx on sales(created_at desc);
create index if not exists sales_status_idx on sales(status);
create index if not exists sales_product_idx on sales(product_id);
create index if not exists sales_customer_idx on sales(customer_email);
create index if not exists sales_synced_idx on sales(synced_at desc);

create or replace view sales_summary as
select
  count(*)::bigint as total_sales,
  coalesce(sum(total_amount_cents), 0)::bigint as gross_amount_cents,
  coalesce(sum(net_amount_cents), 0)::bigint as net_amount_cents,
  coalesce(sum(fee_amount_cents), 0)::bigint as fee_amount_cents,
  max(coalesce(paid_at, created_at)) as last_sale_at,
  max(synced_at) as last_synced_at
from sales;
