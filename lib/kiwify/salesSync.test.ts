import assert from 'node:assert/strict';
import test from 'node:test';

import { mapSalePayload } from '@/lib/kiwify/salesSync';

test('mapSalePayload uses payment amounts when they are the only values provided', () => {
  const payload: Record<string, unknown> = {
    id: 'sale-payment-only',
    payment: {
      charge_amount: 18750,
      net_amount: 17250,
      fee: 1500
    }
  };

  const mapped = mapSalePayload(payload);

  assert.ok(mapped, 'expected payload to be mapped');
  assert.strictEqual(mapped.total_amount_cents, 18750);
  assert.strictEqual(mapped.net_amount_cents, 17250);
  assert.strictEqual(mapped.fee_amount_cents, 1500);
});

test('mapSalePayload keeps cent-based net amounts without scaling', () => {
  const payload: Record<string, unknown> = {
    id: 'sale-cent-net-amount',
    net_amount: '1116'
  };

  const mapped = mapSalePayload(payload);

  assert.ok(mapped, 'expected payload to be mapped');
  assert.strictEqual(mapped.net_amount_cents, 1116);
});
