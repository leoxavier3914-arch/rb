import assert from 'node:assert/strict';
import test from 'node:test';

import { toAmountInCents } from '@/lib/finance';

test('toAmountInCents converts decimal strings to cents', () => {
  assert.strictEqual(toAmountInCents('123.45'), 12345);
  assert.strictEqual(toAmountInCents('123,45'), 12345);
  assert.strictEqual(toAmountInCents('1.234,56'), 123456);
  assert.strictEqual(toAmountInCents('1,234.56'), 123456);
  assert.strictEqual(toAmountInCents('123.00'), 12300);
});

test('toAmountInCents keeps integer cent values intact', () => {
  assert.strictEqual(toAmountInCents(12345), 12345);
  assert.strictEqual(toAmountInCents('12345'), 12345);
});

test('toAmountInCents rejects invalid or negative values', () => {
  assert.strictEqual(toAmountInCents(-10), null);
  assert.strictEqual(toAmountInCents('-10'), null);
  assert.strictEqual(toAmountInCents('abc'), null);
});
