begin;

alter table if exists kfy_orders drop constraint if exists kfy_orders_customer_id_fkey;
alter table if exists kfy_sales drop constraint if exists kfy_sales_customer_id_fkey;
alter table if exists kfy_subscriptions drop constraint if exists kfy_subscriptions_customer_id_fkey;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_customer_id_fkey;

alter table if exists kfy_customers alter column id drop identity if exists;
alter table if exists kfy_customers alter column id drop default;
alter table if exists kfy_customers alter column id type text using id::text;
alter table if exists kfy_customers drop constraint if exists kfy_customers_pkey;
alter table if exists kfy_customers add constraint kfy_customers_pkey primary key (id);

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

do $$
begin
  if to_regclass('public.kfy_orders') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'kfy_orders_customer_id_fkey'
        and conrelid = 'public.kfy_orders'::regclass
    ) then
      alter table kfy_orders
        add constraint kfy_orders_customer_id_fkey foreign key (customer_id) references kfy_customers(id);
    end if;
  end if;

  if to_regclass('public.kfy_sales') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'kfy_sales_customer_id_fkey'
        and conrelid = 'public.kfy_sales'::regclass
    ) then
      alter table kfy_sales
        add constraint kfy_sales_customer_id_fkey foreign key (customer_id) references kfy_customers(id);
    end if;
  end if;

  if to_regclass('public.kfy_subscriptions') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'kfy_subscriptions_customer_id_fkey'
        and conrelid = 'public.kfy_subscriptions'::regclass
    ) then
      alter table kfy_subscriptions
        add constraint kfy_subscriptions_customer_id_fkey foreign key (customer_id) references kfy_customers(id);
    end if;
  end if;

  if to_regclass('public.kfy_enrollments') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'kfy_enrollments_customer_id_fkey'
        and conrelid = 'public.kfy_enrollments'::regclass
    ) then
      alter table kfy_enrollments
        add constraint kfy_enrollments_customer_id_fkey foreign key (customer_id) references kfy_customers(id);
    end if;
  end if;
end;
$$;

commit;
