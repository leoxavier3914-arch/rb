import assert from 'node:assert/strict';
import test from 'node:test';

import { createWebhook, listWebhooks, updateWebhook } from '@/lib/webhooks';
import type { KiwifyClient } from '@/lib/kiwify/client';

function createMockClient(
  handler: (path: string, init?: RequestInit) => Promise<Response>
): KiwifyClient {
  return {
    token: 'test-token',
    request: handler
  };
}

test('listWebhooks maps webhook payloads returned by the API', async () => {
  const requests: { path: string; init?: RequestInit }[] = [];
  const responsePayload = {
    data: [
      {
        id: 'wh-1',
        url: 'https://example.com/webhooks',
        status: 'active',
        events: ['sale.created', 'sale.approved'],
        secret: 'abc',
        created_at: '2024-06-01T10:00:00Z',
        updated_at: '2024-06-02T12:30:00Z'
      }
    ]
  };

  const client = createMockClient(async (path, init) => {
    requests.push({ path, init });
    return new Response(JSON.stringify(responsePayload), { status: 200 });
  });

  const webhooks = await listWebhooks(client);

  assert.strictEqual(requests.length, 1);
  assert.strictEqual(requests[0]?.path, '/webhooks');
  assert.strictEqual(webhooks.length, 1);
  const webhook = webhooks[0]!;
  assert.strictEqual(webhook.id, 'wh-1');
  assert.strictEqual(webhook.url, 'https://example.com/webhooks');
  assert.deepStrictEqual(webhook.events, ['sale.created', 'sale.approved']);
  assert.strictEqual(webhook.status, 'active');
  assert.strictEqual(webhook.secret, 'abc');
  assert.strictEqual(webhook.createdAt, new Date('2024-06-01T10:00:00Z').toISOString());
  assert.strictEqual(webhook.updatedAt, new Date('2024-06-02T12:30:00Z').toISOString());
});

test('createWebhook normalizes payload before sending to the API', async () => {
  let captured: { path: string; init?: RequestInit } | null = null;
  const client = createMockClient(async (path, init) => {
    captured = { path, init };
    return new Response(
      JSON.stringify({
        id: 'wh-new',
        url: 'https://example.com/webhooks',
        status: 'active',
        events: ['sale.created'],
        secret: 'secret',
        created_at: '2024-06-01T10:00:00Z',
        updated_at: '2024-06-01T10:00:00Z'
      }),
      { status: 201 }
    );
  });

  const webhook = await createWebhook(
    {
      url: ' https://example.com/webhooks ',
      events: [' sale.created ', ''],
      status: 'ACTIVE',
      secret: ' secret '
    },
    client
  );

  assert.ok(captured, 'expected the request to be captured');
  assert.strictEqual(captured?.path, '/webhooks');
  const body = captured?.init?.body;
  assert.ok(typeof body === 'string', 'expected request body to be a string');
  const parsedBody = JSON.parse(body!);
  assert.deepStrictEqual(parsedBody, {
    url: 'https://example.com/webhooks',
    events: ['sale.created'],
    status: 'active',
    secret: 'secret'
  });

  assert.strictEqual(webhook.id, 'wh-new');
  assert.strictEqual(webhook.url, 'https://example.com/webhooks');
  assert.deepStrictEqual(webhook.events, ['sale.created']);
  assert.strictEqual(webhook.status, 'active');
});

test('updateWebhook accepts partial updates and trims values', async () => {
  let captured: { path: string; init?: RequestInit } | null = null;
  const client = createMockClient(async (path, init) => {
    captured = { path, init };
    return new Response(
      JSON.stringify({
        id: 'wh-1',
        url: 'https://example.com/new-webhook',
        status: 'inactive',
        events: ['sale.canceled'],
        updated_at: '2024-06-05T08:00:00Z'
      }),
      { status: 200 }
    );
  });

  const webhook = await updateWebhook(
    'wh-1',
    {
      url: ' https://example.com/new-webhook ',
      events: [' sale.canceled '],
      status: 'INACTIVE'
    },
    client
  );

  assert.ok(captured, 'expected the request to be captured');
  assert.strictEqual(captured?.path, '/webhooks/wh-1');
  assert.strictEqual(captured?.init?.method, 'PATCH');
  const body = captured?.init?.body;
  assert.ok(typeof body === 'string', 'expected request body to be a string');
  const parsedBody = JSON.parse(body!);
  assert.deepStrictEqual(parsedBody, {
    url: 'https://example.com/new-webhook',
    events: ['sale.canceled'],
    status: 'inactive'
  });

  assert.strictEqual(webhook.id, 'wh-1');
  assert.strictEqual(webhook.url, 'https://example.com/new-webhook');
  assert.deepStrictEqual(webhook.events, ['sale.canceled']);
  assert.strictEqual(webhook.status, 'inactive');
});

