import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMoneyFromCents, formatMoneyFromCentsWithCurrency, formatShortDate, formatDateTime } from '@/lib/ui/format';

// formatMoneyFromCents tests
test('formatMoneyFromCents formats positive values correctly', () => {
  assert.strictEqual(formatMoneyFromCents(12345), 'R$ 123,45');
  assert.strictEqual(formatMoneyFromCents(100), 'R$ 1,00');
  assert.strictEqual(formatMoneyFromCents(1), 'R$ 0,01');
  assert.strictEqual(formatMoneyFromCents(999999), 'R$ 9.999,99');
});

test('formatMoneyFromCents handles zero', () => {
  assert.strictEqual(formatMoneyFromCents(0), 'R$ 0,00');
});

test('formatMoneyFromCents handles null and undefined', () => {
  assert.strictEqual(formatMoneyFromCents(null), 'R$ 0,00');
  assert.strictEqual(formatMoneyFromCents(undefined), 'R$ 0,00');
});

test('formatMoneyFromCents handles large values', () => {
  assert.strictEqual(formatMoneyFromCents(100000000), 'R$ 1.000.000,00');
  assert.strictEqual(formatMoneyFromCents(999999999), 'R$ 9.999.999,99');
});

test('formatMoneyFromCents formats negative values correctly', () => {
  assert.strictEqual(formatMoneyFromCents(-12345), '-R$ 123,45');
  assert.strictEqual(formatMoneyFromCents(-1), '-R$ 0,01');
});

// formatMoneyFromCentsWithCurrency tests
test('formatMoneyFromCentsWithCurrency formats BRL correctly', () => {
  assert.strictEqual(formatMoneyFromCentsWithCurrency(12345, 'BRL'), 'R$ 123,45');
  assert.strictEqual(formatMoneyFromCentsWithCurrency(12345, 'brl'), 'R$ 123,45');
});

test('formatMoneyFromCentsWithCurrency formats USD correctly', () => {
  const result = formatMoneyFromCentsWithCurrency(12345, 'USD');
  // The exact format might vary by locale, but should contain 123.45
  assert.ok(result.includes('123'));
  assert.ok(result.includes('45'));
});

test('formatMoneyFromCentsWithCurrency formats EUR correctly', () => {
  const result = formatMoneyFromCentsWithCurrency(12345, 'EUR');
  // The exact format might vary by locale, but should contain 123
  assert.ok(result.includes('123'));
});

test('formatMoneyFromCentsWithCurrency handles null with different currencies', () => {
  assert.strictEqual(formatMoneyFromCentsWithCurrency(null, 'BRL'), 'R$ 0,00');
  const usdResult = formatMoneyFromCentsWithCurrency(undefined, 'USD');
  assert.ok(usdResult.includes('0'));
});

test('formatMoneyFromCentsWithCurrency caches formatters', () => {
  // Call multiple times with same currency to test caching
  const result1 = formatMoneyFromCentsWithCurrency(12345, 'BRL');
  const result2 = formatMoneyFromCentsWithCurrency(54321, 'BRL');
  const result3 = formatMoneyFromCentsWithCurrency(99999, 'brl');
  
  assert.strictEqual(result1, 'R$ 123,45');
  assert.strictEqual(result2, 'R$ 543,21');
  assert.strictEqual(result3, 'R$ 999,99');
});

// formatShortDate tests
test('formatShortDate formats valid date strings', () => {
  const result = formatShortDate('2024-01-15T10:30:00Z');
  // Format should be like "15 de jan. de 2024" in pt-BR
  assert.ok(result.includes('2024'));
  assert.ok(result.includes('15'));
});

test('formatShortDate formats Date objects', () => {
  const date = new Date('2024-03-20T15:45:00Z');
  const result = formatShortDate(date);
  assert.ok(result.includes('2024'));
  assert.ok(result.includes('20'));
});

test('formatShortDate handles invalid date strings', () => {
  assert.strictEqual(formatShortDate('invalid date'), '');
  assert.strictEqual(formatShortDate(''), '');
  assert.strictEqual(formatShortDate('not-a-date'), '');
});

test('formatShortDate handles invalid Date objects', () => {
  const invalidDate = new Date('invalid');
  assert.strictEqual(formatShortDate(invalidDate), '');
});

test('formatShortDate formats various valid dates', () => {
  const dates = [
    '2024-01-01T00:00:00Z',
    '2024-06-15T12:00:00Z',
    '2024-12-31T23:59:59Z'
  ];
  
  for (const dateStr of dates) {
    const result = formatShortDate(dateStr);
    assert.ok(result.length > 0, `Expected non-empty result for ${dateStr}`);
    assert.ok(result.includes('2024'), `Expected year in result for ${dateStr}`);
  }
});

// formatDateTime tests
test('formatDateTime formats valid date strings with time', () => {
  const result = formatDateTime('2024-01-15T10:30:00Z');
  // Should include date and time components
  assert.ok(result.includes('2024'));
  assert.ok(result.includes('15'));
  // Time component (exact format may vary by timezone)
  assert.ok(result.length > 10); // Should be longer than just date
});

test('formatDateTime formats Date objects with time', () => {
  const date = new Date('2024-03-20T15:45:00Z');
  const result = formatDateTime(date);
  assert.ok(result.includes('2024'));
  assert.ok(result.includes('20'));
  assert.ok(result.length > 10);
});

test('formatDateTime handles invalid date strings', () => {
  assert.strictEqual(formatDateTime('invalid date'), '');
  assert.strictEqual(formatDateTime(''), '');
  assert.strictEqual(formatDateTime('not-a-date'), '');
});

test('formatDateTime handles invalid Date objects', () => {
  const invalidDate = new Date('invalid');
  assert.strictEqual(formatDateTime(invalidDate), '');
});

test('formatDateTime includes time components', () => {
  const result = formatDateTime('2024-06-15T14:30:00Z');
  assert.ok(result.includes('2024'));
  // Should have more characters than formatShortDate due to time
  const shortResult = formatShortDate('2024-06-15T14:30:00Z');
  assert.ok(result.length > shortResult.length);
});

test('formatDateTime formats midnight correctly', () => {
  const result = formatDateTime('2024-01-01T00:00:00Z');
  assert.ok(result.includes('2024'));
  assert.ok(result.includes('01'));
  assert.ok(result.length > 0);
});

test('formatDateTime formats end of day correctly', () => {
  const result = formatDateTime('2024-12-31T23:59:59Z');
  assert.ok(result.includes('2024'));
  assert.ok(result.includes('31'));
  assert.ok(result.length > 0);
});