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
