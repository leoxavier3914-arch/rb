begin;

-- Ensure ID columns are TEXT without identity/default
alter table if exists kfy_products alter column id drop identity if exists;
alter table if exists kfy_products alter column id drop default;
alter table if exists kfy_products alter column id type text using id::text;
alter table if exists kfy_products drop constraint if exists kfy_products_pkey;
alter table if exists kfy_products add constraint kfy_products_pkey primary key (id);

alter table if exists kfy_customers alter column id drop identity if exists;
alter table if exists kfy_customers alter column id drop default;
alter table if exists kfy_customers alter column id type text using id::text;
alter table if exists kfy_customers drop constraint if exists kfy_customers_pkey;
alter table if exists kfy_customers add constraint kfy_customers_pkey primary key (id);

alter table if exists kfy_sales alter column id drop identity if exists;
alter table if exists kfy_sales alter column id drop default;
alter table if exists kfy_sales alter column id type text using id::text;
alter table if exists kfy_sales drop constraint if exists kfy_sales_pkey;
alter table if exists kfy_sales add constraint kfy_sales_pkey primary key (id);

alter table if exists kfy_subscriptions alter column id drop identity if exists;
alter table if exists kfy_subscriptions alter column id drop default;
alter table if exists kfy_subscriptions alter column id type text using id::text;
alter table if exists kfy_subscriptions drop constraint if exists kfy_subscriptions_pkey;
alter table if exists kfy_subscriptions add constraint kfy_subscriptions_pkey primary key (id);

alter table if exists kfy_enrollments alter column id drop identity if exists;
alter table if exists kfy_enrollments alter column id drop default;
alter table if exists kfy_enrollments alter column id type text using id::text;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_pkey;
alter table if exists kfy_enrollments add constraint kfy_enrollments_pkey primary key (id);

alter table if exists kfy_coupons alter column id drop identity if exists;
alter table if exists kfy_coupons alter column id drop default;
alter table if exists kfy_coupons alter column id type text using id::text;
alter table if exists kfy_coupons drop constraint if exists kfy_coupons_pkey;
alter table if exists kfy_coupons add constraint kfy_coupons_pkey primary key (id);

alter table if exists kfy_refunds alter column id drop identity if exists;
alter table if exists kfy_refunds alter column id drop default;
alter table if exists kfy_refunds alter column id type text using id::text;
alter table if exists kfy_refunds drop constraint if exists kfy_refunds_pkey;
alter table if exists kfy_refunds add constraint kfy_refunds_pkey primary key (id);

alter table if exists kfy_payouts alter column id drop identity if exists;
alter table if exists kfy_payouts alter column id drop default;
alter table if exists kfy_payouts alter column id type text using id::text;
alter table if exists kfy_payouts drop constraint if exists kfy_payouts_pkey;
alter table if exists kfy_payouts add constraint kfy_payouts_pkey primary key (id);

-- Ensure customer foreign keys use text type and strict rules
alter table if exists kfy_orders alter column customer_id drop identity if exists;
alter table if exists kfy_orders alter column customer_id drop default;
alter table if exists kfy_orders alter column customer_id type text using customer_id::text;

alter table if exists kfy_sales alter column customer_id drop identity if exists;
alter table if exists kfy_sales alter column customer_id drop default;
alter table if exists kfy_sales alter column customer_id type text using customer_id::text;

alter table if exists kfy_subscriptions alter column customer_id drop identity if exists;
alter table if exists kfy_subscriptions alter column customer_id drop default;
alter table if exists kfy_subscriptions alter column customer_id type text using customer_id::text;

alter table if exists kfy_enrollments alter column customer_id drop identity if exists;
alter table if exists kfy_enrollments alter column customer_id drop default;
alter table if exists kfy_enrollments alter column customer_id type text using customer_id::text;

alter table if exists kfy_orders drop constraint if exists kfy_orders_customer_id_fkey;
alter table if exists kfy_sales drop constraint if exists kfy_sales_customer_id_fkey;
alter table if exists kfy_subscriptions drop constraint if exists kfy_subscriptions_customer_id_fkey;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_customer_id_fkey;

do $$
begin
  if to_regclass('public.kfy_orders') is not null then
    alter table kfy_orders
      add constraint kfy_orders_customer_id_fkey foreign key (customer_id) references kfy_customers(id)
      on update restrict on delete restrict;
  end if;

  if to_regclass('public.kfy_sales') is not null then
    alter table kfy_sales
      add constraint kfy_sales_customer_id_fkey foreign key (customer_id) references kfy_customers(id)
      on update restrict on delete restrict;
  end if;

  if to_regclass('public.kfy_subscriptions') is not null then
    alter table kfy_subscriptions
      add constraint kfy_subscriptions_customer_id_fkey foreign key (customer_id) references kfy_customers(id)
      on update restrict on delete restrict;
  end if;

  if to_regclass('public.kfy_enrollments') is not null then
    alter table kfy_enrollments
      add constraint kfy_enrollments_customer_id_fkey foreign key (customer_id) references kfy_customers(id)
      on update restrict on delete restrict;
  end if;
end;
$$;

-- Helper views for Backfill Doctor
create or replace view kfy_doctor_columns as
select
  table_name,
  column_name,
  data_type,
  is_identity,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'kfy_products',
    'kfy_customers',
    'kfy_sales',
    'kfy_subscriptions',
    'kfy_enrollments',
    'kfy_coupons',
    'kfy_refunds',
    'kfy_payouts'
  );

create or replace view kfy_doctor_foreign_keys as
select
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  rc.update_rule,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.constraint_schema = kcu.constraint_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
  and rc.constraint_schema = tc.constraint_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.constraint_name in (
    'kfy_orders_customer_id_fkey',
    'kfy_sales_customer_id_fkey',
    'kfy_subscriptions_customer_id_fkey',
    'kfy_enrollments_customer_id_fkey'
  );

commit;
