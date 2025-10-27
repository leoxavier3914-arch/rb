begin;

-- Ensure ID columns are TEXT without identity/default
alter table if exists kfy_orders drop constraint if exists kfy_orders_product_id_fkey;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_product_id_fkey;

do $$
declare
  rec record;
begin
  for rec in (
    select table_name, column_name
    from (values
      ('kfy_products', 'id'),
      ('kfy_customers', 'id'),
      ('kfy_sales', 'id'),
      ('kfy_subscriptions', 'id'),
      ('kfy_enrollments', 'id'),
      ('kfy_coupons', 'id'),
      ('kfy_refunds', 'id'),
      ('kfy_payouts', 'id'),
      ('kfy_orders', 'customer_id'),
      ('kfy_sales', 'customer_id'),
      ('kfy_subscriptions', 'customer_id'),
      ('kfy_enrollments', 'customer_id'),
      ('kfy_orders', 'product_id'),
      ('kfy_enrollments', 'product_id')
    ) as cols(table_name, column_name)
  ) loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = rec.table_name
        and column_name = rec.column_name
        and (
          data_type <> 'text'
          or identity_generation is not null
          or column_default is not null
        )
    ) then
      execute format(
        'alter table if exists %I.%I alter column %I drop identity if exists',
        'public',
        rec.table_name,
        rec.column_name
      );
      execute format(
        'alter table if exists %I.%I alter column %I drop default',
        'public',
        rec.table_name,
        rec.column_name
      );
      execute format(
        'alter table if exists %I.%I alter column %I type text using %I::text',
        'public',
        rec.table_name,
        rec.column_name,
        rec.column_name
      );
    end if;
  end loop;
end;
$$;

alter table if exists kfy_products drop constraint if exists kfy_products_pkey;
alter table if exists kfy_products add constraint kfy_products_pkey primary key (id);

alter table if exists kfy_customers drop constraint if exists kfy_customers_pkey;
alter table if exists kfy_customers add constraint kfy_customers_pkey primary key (id);

alter table if exists kfy_sales drop constraint if exists kfy_sales_pkey;
alter table if exists kfy_sales add constraint kfy_sales_pkey primary key (id);

alter table if exists kfy_subscriptions drop constraint if exists kfy_subscriptions_pkey;
alter table if exists kfy_subscriptions add constraint kfy_subscriptions_pkey primary key (id);

alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_pkey;
alter table if exists kfy_enrollments add constraint kfy_enrollments_pkey primary key (id);

alter table if exists kfy_coupons drop constraint if exists kfy_coupons_pkey;
alter table if exists kfy_coupons add constraint kfy_coupons_pkey primary key (id);

alter table if exists kfy_refunds drop constraint if exists kfy_refunds_pkey;
alter table if exists kfy_refunds add constraint kfy_refunds_pkey primary key (id);

alter table if exists kfy_payouts drop constraint if exists kfy_payouts_pkey;
alter table if exists kfy_payouts add constraint kfy_payouts_pkey primary key (id);

-- Ensure customer foreign keys use text type and strict rules
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
    'kfy_enrollments_customer_id_fkey',
    'kfy_orders_product_id_fkey',
    'kfy_enrollments_product_id_fkey'
  );

do $$
begin
  if to_regclass('public.kfy_orders') is not null then
    alter table kfy_orders
      add constraint kfy_orders_product_id_fkey foreign key (product_id) references kfy_products(id)
      on update restrict on delete restrict;
  end if;

  if to_regclass('public.kfy_enrollments') is not null then
    alter table kfy_enrollments
      add constraint kfy_enrollments_product_id_fkey foreign key (product_id) references kfy_products(id)
      on update restrict on delete restrict;
  end if;
end;
$$;

commit;
