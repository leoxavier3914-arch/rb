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
