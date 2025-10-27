begin;

alter table if exists kfy_products
  add column if not exists external_id text;

alter table if exists kfy_customers
  add column if not exists external_id text;

do $$
begin
  if to_regclass('public.kfy_products') is not null then
    execute 'update kfy_products set external_id = id where external_id is null';
  end if;

  if to_regclass('public.kfy_customers') is not null then
    execute 'update kfy_customers set external_id = id where external_id is null';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'kfy_products'
       and column_name = 'external_id'
       and is_nullable = 'YES'
  ) then
    execute 'alter table kfy_products alter column external_id set not null';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'kfy_customers'
       and column_name = 'external_id'
       and is_nullable = 'YES'
  ) then
    execute 'alter table kfy_customers alter column external_id set not null';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.kfy_products') is not null then
    if not exists (
      select 1
        from pg_constraint
       where conname = 'kfy_products_external_id_key'
         and conrelid = 'public.kfy_products'::regclass
    ) then
      execute 'alter table kfy_products add constraint kfy_products_external_id_key unique (external_id)';
    end if;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.kfy_customers') is not null then
    if to_regclass('public.kfy_customers_external_id_idx') is null then
      execute 'create index kfy_customers_external_id_idx on kfy_customers (external_id)';
    end if;
  end if;
end;
$$;

commit;
