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
        name: 'Webhook principal',
        url: 'https://example.com/webhooks',
        products: 'all_products',
        triggers: ['compra_aprovada', 'chargeback'],
        token: 'abc',
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
  assert.strictEqual(webhook.name, 'Webhook principal');
  assert.strictEqual(webhook.url, 'https://example.com/webhooks');
  assert.deepStrictEqual(webhook.triggers, ['compra_aprovada', 'chargeback']);
  assert.strictEqual(webhook.products, 'all');
  assert.strictEqual(webhook.token, 'abc');
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
        name: 'Webhook Principal',
        url: 'https://example.com/webhooks',
        products: 'all_products',
        triggers: ['compra_aprovada'],
        token: 'secret',
        created_at: '2024-06-01T10:00:00Z',
        updated_at: '2024-06-01T10:00:00Z'
      }),
      { status: 201 }
    );
  });

  const webhook = await createWebhook(
    {
      url: ' https://example.com/webhooks ',
      triggers: [' compra_aprovada ', '', 'inexistente'],
      name: ' Principal ',
      products: ' all ',
      token: ' secret '
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
    triggers: ['compra_aprovada'],
    products: 'all_products',
    name: 'Principal',
    token: 'secret'
  });

  assert.strictEqual(webhook.id, 'wh-new');
  assert.strictEqual(webhook.url, 'https://example.com/webhooks');
  assert.deepStrictEqual(webhook.triggers, ['compra_aprovada']);
  assert.strictEqual(webhook.products, 'all');
  assert.strictEqual(webhook.name, 'Webhook Principal');
  assert.strictEqual(webhook.token, 'secret');
});

test('updateWebhook accepts partial updates and trims values', async () => {
  let captured: { path: string; init?: RequestInit } | null = null;
  const client = createMockClient(async (path, init) => {
    captured = { path, init };
    return new Response(
      JSON.stringify({
        id: 'wh-1',
        url: 'https://example.com/new-webhook',
        products: 'produto-123',
        triggers: ['compra_recusada'],
        token: null,
        updated_at: '2024-06-05T08:00:00Z'
      }),
      { status: 200 }
    );
  });

  const webhook = await updateWebhook(
    'wh-1',
    {
      url: ' https://example.com/new-webhook ',
      triggers: [' compra_recusada '],
      name: ' Atualizado ',
      products: ' produto-123 ',
      token: '  '
    },
    client
  );

  assert.ok(captured, 'expected the request to be captured');
  assert.strictEqual(captured?.path, '/webhooks/wh-1');
  assert.strictEqual(captured?.init?.method, 'PUT');
  const body = captured?.init?.body;
  assert.ok(typeof body === 'string', 'expected request body to be a string');
  const parsedBody = JSON.parse(body!);
  assert.deepStrictEqual(parsedBody, {
    url: 'https://example.com/new-webhook',
    triggers: ['compra_recusada'],
    name: 'Atualizado',
    products: 'produto-123',
    token: null
  });

  assert.strictEqual(webhook.id, 'wh-1');
  assert.strictEqual(webhook.url, 'https://example.com/new-webhook');
  assert.deepStrictEqual(webhook.triggers, ['compra_recusada']);
  assert.strictEqual(webhook.products, 'produto-123');
  assert.strictEqual(webhook.token, null);
});

test('updateWebhook envia escopo global como null', async () => {
  let captured: { path: string; init?: RequestInit } | null = null;
  const client = createMockClient(async (path, init) => {
    captured = { path, init };
    return new Response(
      JSON.stringify({
        id: 'wh-2',
        url: 'https://example.com/webhooks',
        name: 'Atualizado',
        products: 'all_products',
        triggers: ['compra_aprovada']
      }),
      { status: 200 }
    );
  });

  await updateWebhook(
    'wh-2',
    {
      name: ' Atualizado ',
      products: ' ALL '
    },
    client
  );

  assert.ok(captured, 'expected the request to be captured');
  assert.strictEqual(captured?.path, '/webhooks/wh-2');
  const body = captured?.init?.body;
  assert.ok(typeof body === 'string', 'expected request body to be a string');
  const parsedBody = JSON.parse(body!);
  assert.deepStrictEqual(parsedBody, {
    name: 'Atualizado',
    products: null
  });
});

test('updateWebhook alterna entre produto específico e escopo global', async () => {
  const capturedBodies: unknown[] = [];
  let callCount = 0;
  const client = createMockClient(async (path, init) => {
    capturedBodies.push(init?.body ?? null);
    callCount += 1;
    return new Response(
      JSON.stringify({
        id: 'wh-4',
        url: 'https://example.com/webhooks',
        name: 'Webhook alternado',
        products: callCount === 1 ? 'produto-xyz' : 'all_products',
        triggers: ['compra_aprovada']
      }),
      { status: 200 }
    );
  });

  await updateWebhook(
    'wh-4',
    {
      products: 'produto-xyz'
    },
    client
  );

  await updateWebhook(
    'wh-4',
    {
      products: null
    },
    client
  );

  assert.strictEqual(capturedBodies.length, 2);
  const firstBody = capturedBodies[0];
  assert.ok(typeof firstBody === 'string', 'expected first request body to be a string');
  const firstPayload = JSON.parse(firstBody as string);
  assert.deepStrictEqual(firstPayload, { products: 'produto-xyz' });

  const secondBody = capturedBodies[1];
  assert.ok(typeof secondBody === 'string', 'expected second request body to be a string');
  const secondPayload = JSON.parse(secondBody as string);
  assert.deepStrictEqual(secondPayload, { products: null });
});

test('updateWebhook não envia escopo quando não informado', async () => {
  let captured: { path: string; init?: RequestInit } | null = null;
  const client = createMockClient(async (path, init) => {
    captured = { path, init };
    return new Response(
      JSON.stringify({
        id: 'wh-3',
        url: 'https://example.com/webhooks',
        name: 'Sem alterações de produtos',
        products: 'produto-xyz',
        triggers: ['compra_aprovada']
      }),
      { status: 200 }
    );
  });

  await updateWebhook(
    'wh-3',
    {
      name: ' Sem alterações de produtos '
    },
    client
  );

  assert.ok(captured, 'expected the request to be captured');
  assert.strictEqual(captured?.path, '/webhooks/wh-3');
  const body = captured?.init?.body;
  assert.ok(typeof body === 'string', 'expected request body to be a string');
  const parsedBody = JSON.parse(body!);
  assert.deepStrictEqual(parsedBody, {
    name: 'Sem alterações de produtos'
  });
});

