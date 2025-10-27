begin;

alter table if exists kfy_orders drop constraint if exists kfy_orders_customer_id_fkey;
alter table if exists kfy_sales drop constraint if exists kfy_sales_customer_id_fkey;
alter table if exists kfy_subscriptions drop constraint if exists kfy_subscriptions_customer_id_fkey;
alter table if exists kfy_enrollments drop constraint if exists kfy_enrollments_customer_id_fkey;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kfy_customers'
      and column_name = 'id'
      and (
        data_type <> 'text'
        or identity_generation is not null
        or column_default is not null
      )
  ) then
    execute 'alter table if exists kfy_customers alter column id drop identity if exists';
    execute 'alter table if exists kfy_customers alter column id drop default';
    execute 'alter table if exists kfy_customers alter column id type text using id::text';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kfy_orders'
      and column_name = 'customer_id'
      and (
        data_type <> 'text'
        or identity_generation is not null
        or column_default is not null
      )
  ) then
    execute 'alter table if exists kfy_orders alter column customer_id drop identity if exists';
    execute 'alter table if exists kfy_orders alter column customer_id drop default';
    execute 'alter table if exists kfy_orders alter column customer_id type text using customer_id::text';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kfy_sales'
      and column_name = 'customer_id'
      and (
        data_type <> 'text'
        or identity_generation is not null
        or column_default is not null
      )
  ) then
    execute 'alter table if exists kfy_sales alter column customer_id drop identity if exists';
    execute 'alter table if exists kfy_sales alter column customer_id drop default';
    execute 'alter table if exists kfy_sales alter column customer_id type text using customer_id::text';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kfy_subscriptions'
      and column_name = 'customer_id'
      and (
        data_type <> 'text'
        or identity_generation is not null
        or column_default is not null
      )
  ) then
    execute 'alter table if exists kfy_subscriptions alter column customer_id drop identity if exists';
    execute 'alter table if exists kfy_subscriptions alter column customer_id drop default';
    execute 'alter table if exists kfy_subscriptions alter column customer_id type text using customer_id::text';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kfy_enrollments'
      and column_name = 'customer_id'
      and (
        data_type <> 'text'
        or identity_generation is not null
        or column_default is not null
      )
  ) then
    execute 'alter table if exists kfy_enrollments alter column customer_id drop identity if exists';
    execute 'alter table if exists kfy_enrollments alter column customer_id drop default';
    execute 'alter table if exists kfy_enrollments alter column customer_id type text using customer_id::text';
  end if;
end;
$$;

alter table if exists kfy_customers drop constraint if exists kfy_customers_pkey;
alter table if exists kfy_customers add constraint kfy_customers_pkey primary key (id);

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
