create table if not exists sales (
  id text primary key,
  status text,
  product_name text,
  customer_name text,
  customer_email text,
  total_amount_cents bigint default 0 not null,
  net_amount_cents bigint default 0 not null,
  fee_amount_cents bigint default 0 not null,
  currency text default 'BRL',
  created_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists sales_status_idx on sales(status);
create index if not exists sales_created_at_idx on sales(created_at);
create index if not exists sales_product_name_idx on sales(product_name);

create or replace function sales_stats()
returns table (
  total_sales bigint,
  gross_amount_cents bigint,
  net_amount_cents bigint,
  fee_amount_cents bigint,
  last_sale_at timestamptz
)
language sql
stable
as $$
  select
    count(*)::bigint as total_sales,
    coalesce(sum(total_amount_cents), 0)::bigint as gross_amount_cents,
    coalesce(sum(net_amount_cents), 0)::bigint as net_amount_cents,
    coalesce(sum(fee_amount_cents), 0)::bigint as fee_amount_cents,
    max(created_at)::timestamptz as last_sale_at
  from sales;
$$;
