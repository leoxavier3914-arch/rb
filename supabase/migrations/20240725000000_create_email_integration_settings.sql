-- 20240725000000_create_email_integration_settings.sql
begin;

create table if not exists public.email_integration_settings (
  id text primary key,
  automatic_email_enabled boolean not null default true,
  manual_email_enabled boolean not null default true,
  smart_delay_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.email_integration_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.abandoned_emails
  alter column status set default 'new';

commit;
