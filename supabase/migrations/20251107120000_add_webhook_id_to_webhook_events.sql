alter table webhook_events
  add column if not exists webhook_id text;

update webhook_events as we
set webhook_id = ws.webhook_id
from webhook_settings as ws
where we.webhook_id is null
  and we.webhook_token is not null
  and ws.token is not null
  and trim(ws.token) <> ''
  and trim(we.webhook_token) = trim(ws.token);

create index if not exists webhook_events_webhook_id_idx on webhook_events(coalesce(webhook_id, ''));
