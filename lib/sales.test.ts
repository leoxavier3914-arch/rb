import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pickSaleTimestamp } from './sales';

test('pickSaleTimestamp usa paid_at como Date quando disponível', () => {
  const paidAt = new Date('2024-05-02T12:00:00Z');
  const createdAt = '2024-05-01T08:30:00Z';

  const result = pickSaleTimestamp(paidAt, createdAt);

  assert.equal(result, paidAt.toISOString());
});
