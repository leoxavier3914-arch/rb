alter table public.abandoned_emails
  add column if not exists traffic_source text;

update public.abandoned_emails
set traffic_source = 'unknown'
where traffic_source is null or traffic_source = '';

alter table public.abandoned_emails
  alter column traffic_source set default 'unknown';

alter table public.abandoned_emails
  alter column traffic_source set not null;
