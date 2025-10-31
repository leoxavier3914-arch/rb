import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveIncomingWebhookEvent } from '@/lib/webhooks/events';
import { type KiwifyClient } from '@/lib/kiwify/client';
import { type Webhook } from '@/lib/webhooks';
import { type WebhookSetting } from '@/lib/webhooks/settings';

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

test('resolveWebhookIdFromToken maps tokens returned by the Kiwify API when settings are missing', async () => {
  const { __testing } = await import('@/lib/webhooks/token-cache');

  __testing.resetTestingState();

  const now = new Date().toISOString();
  const fakeSettings: WebhookSetting[] = [
    {
      webhookId: 'wh-local-1',
      name: 'Local webhook',
      url: 'https://example.com/webhooks/local',
      token: 'tok-local-1',
      isActive: true,
      updatedAt: now
    }
  ];

  const fakeClient = { token: 't' } as unknown as KiwifyClient;
  const remoteWebhooks: Webhook[] = [
    {
      id: 'wh-remote-1',
      name: 'Remote webhook',
      url: 'https://example.com/webhooks/remote',
      products: null,
      triggers: [],
      token: ' tok-remote-1 ',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'wh-remote-2',
      name: 'Remote duplicate token',
      url: 'https://example.com/webhooks/remote-duplicate',
      products: null,
      triggers: [],
      token: 'tok-local-1',
      createdAt: now,
      updatedAt: now
    }
  ];

  __testing.setDependencies({
    listWebhookSettings: async () => fakeSettings,
    createKiwifyClient: async () => fakeClient,
    listWebhooks: async () => remoteWebhooks
  });

  const remoteTokenWebhookId = await __testing.resolveWebhookIdFromToken('tok-remote-1');
  assert.equal(remoteTokenWebhookId, 'wh-remote-1');

  const existingTokenWebhookId = await __testing.resolveWebhookIdFromToken('tok-local-1');
  assert.equal(existingTokenWebhookId, 'wh-local-1');

  __testing.resetTestingState();
});

test('resolveWebhookIdFromToken keeps remote mapping when refreshing cache fails', async () => {
  const { __testing } = await import('@/lib/webhooks/token-cache');

  __testing.resetTestingState();

  try {
    let fetchAttempts = 0;
    const now = new Date().toISOString();
    const remoteWebhooks: Webhook[] = [
      {
        id: 'wh-keep-remote',
        name: 'Remote webhook to keep',
        url: 'https://example.com/webhooks/keep',
        products: null,
        triggers: [],
        token: 'tok-keep-remote',
        createdAt: now,
        updatedAt: now
      }
    ];

    __testing.setDependencies({
      listWebhookSettings: async () => [],
      createKiwifyClient: async () => ({ token: 't' } as unknown as KiwifyClient),
      listWebhooks: async () => {
        fetchAttempts += 1;
        if (fetchAttempts === 1) {
          return remoteWebhooks;
        }
        throw new Error('remote fetch failed');
      }
    });

    const firstResolution = await __testing.resolveWebhookIdFromToken('tok-keep-remote');
    assert.equal(firstResolution, 'wh-keep-remote');
    assert.equal(fetchAttempts, 1);

    const cache = await __testing.ensureWebhookTokensCache();
    cache.expiresAt = Date.now() - 1;

    const resolutionAfterFailure = await __testing.resolveWebhookIdFromToken('tok-keep-remote');
    assert.equal(resolutionAfterFailure, 'wh-keep-remote');
    assert.equal(fetchAttempts, 2);
  } finally {
    __testing.resetTestingState();
  }
});
