import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveIncomingWebhookEvent } from '@/lib/webhooks/events';

test('resolveIncomingWebhookEvent extracts metadata from headers and payload', () => {
  const headers = new Headers({
    'x-kiwify-event': 'compra_aprovada',
    'x-kiwify-event-id': 'evt-123',
    'x-kiwify-account-id': 'acc-1',
    'x-kiwify-webhook-id': 'wh-123',
    'x-kiwify-webhook-token': 'tok-123',
    'user-agent': 'kiwify-webhook'
  });

  const payload = {
    id: 'evt-123',
    status: 'paid',
    created_at: '2024-10-01T12:00:00Z',
    order: {
      id: 'order-999',
      customer_name: 'João'
    }
  };

  const incoming = resolveIncomingWebhookEvent({ payload, headers, receivedAt: '2024-10-01T12:01:00Z' });

  assert.equal(incoming.eventId, 'evt-123');
  assert.equal(incoming.trigger, 'compra_aprovada');
  assert.equal(incoming.status, 'paid');
  assert.equal(incoming.source, 'acc-1');
  assert.equal(incoming.webhookId, 'wh-123');
  assert.equal(incoming.webhookToken, 'tok-123');
  assert.equal(incoming.occurredAt, '2024-10-01T12:00:00.000Z');
  assert.equal(incoming.receivedAt, '2024-10-01T12:01:00.000Z');
  assert.equal(incoming.headers['x-kiwify-event'], 'compra_aprovada');
});

test('resolveIncomingWebhookEvent normalizes trigger and occurs_at from payload when headers are absent', () => {
  const payload = {
    type: 'compra_recusada',
    data: {
      id: 'evt-777',
      status: 'refused',
      created_at: 1_714_500_000
    },
    payload: {
      account_id: 'acc-2',
      token: 'payload-token'
    },
    webhook: {
      id: 'wh-777'
    }
  };

  const incoming = resolveIncomingWebhookEvent({ payload });

  assert.equal(incoming.trigger, 'compra_recusada');
  assert.equal(incoming.eventId, 'evt-777');
  assert.equal(incoming.status, 'refused');
  assert.equal(incoming.source, 'acc-2');
  assert.equal(incoming.webhookId, 'wh-777');
  assert.equal(incoming.webhookToken, 'payload-token');
  assert.equal(new Date(incoming.occurredAt ?? '').getTime(), 1_714_500_000_000);
  assert.deepEqual(incoming.headers, {});
});
