drop index if exists webhook_events_webhook_token_idx;
drop index if exists webhook_events_webhook_id_idx;

alter table webhook_events
  drop column if exists webhook_token;

alter table webhook_events
  drop column if exists webhook_id;
