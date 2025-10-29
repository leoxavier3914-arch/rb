create or replace view sales_summary as
select
  count(*) filter (where status = 'paid')::bigint as total_sales,
  coalesce(sum(total_amount_cents) filter (where status = 'paid'), 0)::bigint as gross_amount_cents,
  coalesce(sum(net_amount_cents) filter (where status = 'paid'), 0)::bigint as net_amount_cents,
  coalesce(sum(fee_amount_cents) filter (where status = 'paid'), 0)::bigint as fee_amount_cents,
  max(created_at) filter (where status = 'paid') as last_sale_at,
  max(synced_at) as last_synced_at
from sales;
