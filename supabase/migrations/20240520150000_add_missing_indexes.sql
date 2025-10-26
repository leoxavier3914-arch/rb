create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

do $$
begin
  -- app_events(status, seen_at)
  if to_regclass('public.app_events') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'app_events'
         and column_name = 'status'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'app_events'
         and column_name = 'seen_at'
     ) then
    execute 'create index if not exists app_events_status_seen_idx on app_events(status, seen_at)';
  end if;

  -- jobs(status)
  if to_regclass('public.jobs') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'jobs'
         and column_name = 'status'
     ) then
    execute 'create index if not exists jobs_status_idx on jobs(status)';
  end if;

  -- kfy_sales(customer_id)
  if to_regclass('public.kfy_sales') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_sales'
         and column_name = 'customer_id'
     ) then
    execute 'create index if not exists kfy_sales_customer_idx on kfy_sales(customer_id)';
  end if;

  -- kfy_sales(lower(id))
  if to_regclass('public.kfy_sales') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_sales'
         and column_name = 'id'
     ) then
    execute 'create index if not exists kfy_sales_id_lower_idx on kfy_sales(lower(id))';
  end if;

  -- kfy_subscriptions(customer_id)
  if to_regclass('public.kfy_subscriptions') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_subscriptions'
         and column_name = 'customer_id'
     ) then
    execute 'create index if not exists kfy_subscriptions_customer_idx on kfy_subscriptions(customer_id)';
  end if;

  -- kfy_subscriptions(product_id)
  if to_regclass('public.kfy_subscriptions') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_subscriptions'
         and column_name = 'product_id'
     ) then
    execute 'create index if not exists kfy_subscriptions_product_idx on kfy_subscriptions(product_id)';
  end if;

  -- kfy_enrollments(customer_id)
  if to_regclass('public.kfy_enrollments') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_enrollments'
         and column_name = 'customer_id'
     ) then
    execute 'create index if not exists kfy_enrollments_customer_idx on kfy_enrollments(customer_id)';
  end if;

  -- kfy_refunds(sale_id)
  if to_regclass('public.kfy_refunds') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_refunds'
         and column_name = 'sale_id'
     ) then
    execute 'create index if not exists kfy_refunds_sale_idx on kfy_refunds(sale_id)';
  end if;

  -- kfy_coupons(lower(code))
  if to_regclass('public.kfy_coupons') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_coupons'
         and column_name = 'code'
     ) then
    execute 'create index if not exists kfy_coupons_code_lower_idx on kfy_coupons(lower(code))';
  end if;

  -- kfy_products(lower(title))
  if to_regclass('public.kfy_products') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_products'
         and column_name = 'title'
     ) then
    execute 'create index if not exists kfy_products_title_lower_idx on kfy_products(lower(title))';
  end if;

  -- kfy_customers(lower(name))
  if to_regclass('public.kfy_customers') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'kfy_customers'
         and column_name = 'name'
     ) then
    execute 'create index if not exists kfy_customers_name_lower_idx on kfy_customers(lower(name))';
  end if;
end
$$;
