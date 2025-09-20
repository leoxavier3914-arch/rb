create table if not exists public.abandoned_emails (
  id text primary key,
  customer_email text not null,
  customer_name text,
  product_id text,
  product_name text,
  checkout_url text,
  status text not null default 'pending',
  discount_code text,
  expires_at timestamptz,
  last_event text,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.abandoned_emails
  add column if not exists customer_email text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'abandoned_emails'
      and column_name = 'customer_email'
      and is_nullable = 'YES'
  ) then
    if not exists (
      select 1
      from public.abandoned_emails
      where customer_email is null
    ) then
      alter table public.abandoned_emails
        alter column customer_email set not null;
    end if;
  end if;
end
$$;

alter table public.abandoned_emails
  add column if not exists customer_name text;

alter table public.abandoned_emails
  add column if not exists product_id text;

alter table public.abandoned_emails
  add column if not exists product_name text;

alter table public.abandoned_emails
  add column if not exists checkout_url text;

alter table public.abandoned_emails
  add column if not exists status text;

update public.abandoned_emails
set status = coalesce(status, 'pending');

alter table public.abandoned_emails
  alter column status set default 'pending';

alter table public.abandoned_emails
  alter column status set not null;

alter table public.abandoned_emails
  add column if not exists discount_code text;

alter table public.abandoned_emails
  add column if not exists expires_at timestamptz;

alter table public.abandoned_emails
  add column if not exists last_event text;

alter table public.abandoned_emails
  add column if not exists last_reminder_at timestamptz;

alter table public.abandoned_emails
  add column if not exists created_at timestamptz;

update public.abandoned_emails
set created_at = coalesce(created_at, now());

alter table public.abandoned_emails
  alter column created_at set default now();

alter table public.abandoned_emails
  alter column created_at set not null;

alter table public.abandoned_emails
  add column if not exists updated_at timestamptz;

update public.abandoned_emails
set updated_at = coalesce(updated_at, now());

alter table public.abandoned_emails
  alter column updated_at set default now();

alter table public.abandoned_emails
  alter column updated_at set not null;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_timestamp_abandoned_emails
before update on public.abandoned_emails
for each row
execute procedure public.handle_updated_at();

create index if not exists abandoned_emails_customer_email_idx
  on public.abandoned_emails (lower(customer_email));

create index if not exists abandoned_emails_status_idx
  on public.abandoned_emails (status);
