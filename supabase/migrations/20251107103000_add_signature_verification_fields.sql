alter table webhook_events
  add column if not exists webhook_id text;

alter table webhook_events
  add column if not exists signature text;

alter table webhook_events
  add column if not exists signature_algorithm text;

alter table webhook_events
  add column if not exists signature_verified boolean;

alter table webhook_events
  add column if not exists verified_webhook_id text;

create index if not exists webhook_events_webhook_id_idx on webhook_events(coalesce(webhook_id, ''));

create index if not exists webhook_events_signature_verified_idx on webhook_events(signature_verified);

create index if not exists webhook_events_verified_webhook_id_idx on webhook_events(coalesce(verified_webhook_id, ''));
