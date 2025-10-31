import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCreatePayoutRequest } from '@/app/api/finance/payouts/handler';

const jsonHeaders = { 'content-type': 'application/json' } as const;

test('POST /api/finance/payouts rejeita valores inválidos', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 'abc' })
  });

  const response = await handleCreatePayoutRequest(request);
  assert.strictEqual(response.status, 400);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.error, 'Informe um valor válido em centavos para solicitar o saque.');
});

test('POST /api/finance/payouts cria saque quando os dados são válidos', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 12300 })
  });

  const response = await handleCreatePayoutRequest(request, async amount => {
    assert.strictEqual(amount, 12300);
    return { id: 'payout-123' };
  });

  assert.strictEqual(response.status, 200);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.deepStrictEqual(payload, { ok: true, payout: { id: 'payout-123' } });
});

test('POST /api/finance/payouts retorna erro quando createPayout falha', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 5000 })
  });

  const response = await handleCreatePayoutRequest(request, async () => {
    throw new Error('Falha na Kiwify');
  });

  assert.strictEqual(response.status, 500);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.error, 'Falha na Kiwify');
});

test('POST /api/finance/payouts rejeita valores zero ou negativos', async () => {
  const request1 = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 0 })
  });

  const response1 = await handleCreatePayoutRequest(request1);
  assert.strictEqual(response1.status, 400);
  const payload1 = (await response1.json()) as Record<string, unknown>;
  assert.strictEqual(payload1.ok, false);
  assert.strictEqual(payload1.error, 'Informe um valor válido em centavos para solicitar o saque.');

  const request2 = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: -100 })
  });

  const response2 = await handleCreatePayoutRequest(request2);
  assert.strictEqual(response2.status, 400);
  const payload2 = (await response2.json()) as Record<string, unknown>;
  assert.strictEqual(payload2.ok, false);
});

test('POST /api/finance/payouts rejeita valores não numéricos especiais', async () => {
  const testCases = [
    { amount: NaN },
    { amount: Infinity },
    { amount: -Infinity },
    { amount: null },
    { amount: undefined },
    {}
  ];

  for (const body of testCases) {
    const request = new Request('http://localhost/api/finance/payouts', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body)
    });

    const response = await handleCreatePayoutRequest(request);
    assert.strictEqual(response.status, 400, `Failed for body: ${JSON.stringify(body)}`);
    const payload = (await response.json()) as Record<string, unknown>;
    assert.strictEqual(payload.ok, false);
    assert.strictEqual(payload.error, 'Informe um valor válido em centavos para solicitar o saque.');
  }
});

test('POST /api/finance/payouts arredonda valores decimais', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 1234.567 })
  });

  const response = await handleCreatePayoutRequest(request, async amount => {
    assert.strictEqual(amount, 1235); // Should be rounded
    return { id: 'payout-rounded' };
  });

  assert.strictEqual(response.status, 200);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, true);
});

test('POST /api/finance/payouts converte strings numéricas válidas', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: '5000' })
  });

  const response = await handleCreatePayoutRequest(request, async amount => {
    assert.strictEqual(amount, 5000);
    return { id: 'payout-from-string' };
  });

  assert.strictEqual(response.status, 200);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, true);
});

test('POST /api/finance/payouts lida com body JSON malformado', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: 'invalid json'
  });

  const response = await handleCreatePayoutRequest(request);
  assert.strictEqual(response.status, 400);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, false);
});

test('POST /api/finance/payouts lida com erros não-Error', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 5000 })
  });

  const response = await handleCreatePayoutRequest(request, async () => {
    throw 'String error'; // eslint-disable-line no-throw-literal
  });

  assert.strictEqual(response.status, 500);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.error, 'Não foi possível solicitar o saque agora.');
});

test('POST /api/finance/payouts aceita valores muito grandes', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 999999999 })
  });

  const response = await handleCreatePayoutRequest(request, async amount => {
    assert.strictEqual(amount, 999999999);
    return { id: 'payout-large' };
  });

  assert.strictEqual(response.status, 200);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, true);
});

test('POST /api/finance/payouts aceita valores mínimos válidos', async () => {
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 1 })
  });

  const response = await handleCreatePayoutRequest(request, async amount => {
    assert.strictEqual(amount, 1);
    return { id: 'payout-min' };
  });

  assert.strictEqual(response.status, 200);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, true);
});

test('POST /api/finance/payouts retorna payout ID na resposta de sucesso', async () => {
  const mockId = 'payout-abc-123-xyz';
  const request = new Request('http://localhost/api/finance/payouts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ amount: 10000 })
  });

  const response = await handleCreatePayoutRequest(request, async () => {
    return { id: mockId };
  });

  assert.strictEqual(response.status, 200);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.strictEqual(payload.ok, true);
  assert.ok(payload.payout);
  assert.strictEqual((payload.payout as { id: string }).id, mockId);
});