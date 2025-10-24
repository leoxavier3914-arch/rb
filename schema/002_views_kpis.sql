create or replace view kfy_kpi_overview as
select
  coalesce(sum(case when status = 'approved' then gross_cents end), 0)::bigint as gross_cents,
  coalesce(sum(case when status = 'approved' then net_cents end), 0)::bigint as net_cents,
  coalesce(sum(case when status = 'approved' then fee_cents end), 0)::bigint as fee_cents,
  coalesce(sum(case when status = 'approved' then commission_cents end), 0)::bigint as commission_cents
from kfy_orders;

create or replace view kfy_status_counts as
select
  count(*) filter (where status = 'approved')::bigint as approved,
  count(*) filter (where status = 'pending')::bigint as pending,
  count(*) filter (where status = 'refunded')::bigint as refunded,
  count(*) filter (where status = 'rejected')::bigint as rejected
from kfy_orders;
