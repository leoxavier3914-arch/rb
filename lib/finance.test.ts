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

// Additional edge cases for toAmountInCents with decimal numbers
test('toAmountInCents handles decimal numbers correctly', () => {
  assert.strictEqual(toAmountInCents(123.45), 12345);
  assert.strictEqual(toAmountInCents(100.5), 10050);
  assert.strictEqual(toAmountInCents(0.01), 1);
  assert.strictEqual(toAmountInCents(0.99), 99);
  assert.strictEqual(toAmountInCents(1.005), 101); // Rounding
});

// Edge cases for zero and near-zero values
test('toAmountInCents handles zero and near-zero values', () => {
  assert.strictEqual(toAmountInCents(0), 0);
  assert.strictEqual(toAmountInCents('0'), 0);
  assert.strictEqual(toAmountInCents('0.00'), 0);
  assert.strictEqual(toAmountInCents('0,00'), 0);
  assert.strictEqual(toAmountInCents(0.001), 0); // Rounds to 0
});

// String formatting edge cases
test('toAmountInCents handles various string formats', () => {
  assert.strictEqual(toAmountInCents('  123.45  '), 12345);
  assert.strictEqual(toAmountInCents('1 234,56'), 123456);
  assert.strictEqual(toAmountInCents('1 234.56'), 123456);
  assert.strictEqual(toAmountInCents('1.234'), 123400); // No decimal separator means integer cents
});

// BigInt support
test('toAmountInCents handles bigint values', () => {
  assert.strictEqual(toAmountInCents(BigInt(12345)), 12345);
  assert.strictEqual(toAmountInCents(BigInt(0)), 0);
  assert.strictEqual(toAmountInCents(BigInt(-100)), null);
});

// Invalid inputs
test('toAmountInCents rejects invalid inputs', () => {
  assert.strictEqual(toAmountInCents(null), null);
  assert.strictEqual(toAmountInCents(undefined), null);
  assert.strictEqual(toAmountInCents(''), null);
  assert.strictEqual(toAmountInCents('   '), null);
  assert.strictEqual(toAmountInCents(NaN), null);
  assert.strictEqual(toAmountInCents(Infinity), null);
  assert.strictEqual(toAmountInCents(-Infinity), null);
  assert.strictEqual(toAmountInCents({}), null);
  assert.strictEqual(toAmountInCents([]), null);
  assert.strictEqual(toAmountInCents(true), null);
  assert.strictEqual(toAmountInCents(false), null);
});

// Special string patterns
test('toAmountInCents handles special string patterns', () => {
  assert.strictEqual(toAmountInCents('abc123'), null);
  assert.strictEqual(toAmountInCents('123abc'), null);
  assert.strictEqual(toAmountInCents('12.34.56'), null);
  assert.strictEqual(toAmountInCents('12,34,56'), null);
  assert.strictEqual(toAmountInCents('12..34'), null);
  assert.strictEqual(toAmountInCents('12,,34'), null);
  assert.strictEqual(toAmountInCents('+123.45'), null); // Plus sign not allowed
  assert.strictEqual(toAmountInCents('$123.45'), null);
});

// Large numbers
test('toAmountInCents handles large numbers', () => {
  assert.strictEqual(toAmountInCents(999999999), 999999999);
  assert.strictEqual(toAmountInCents('999999999'), 999999999);
  assert.strictEqual(toAmountInCents('9999999.99'), 999999999);
  assert.strictEqual(toAmountInCents('9.999.999,99'), 999999999);
});

// Mixed separator scenarios
test('toAmountInCents disambiguates decimal separators correctly', () => {
  // European format: dot as thousand separator, comma as decimal
  assert.strictEqual(toAmountInCents('1.000,50'), 100050);
  assert.strictEqual(toAmountInCents('10.000,99'), 1000099);
  
  // US format: comma as thousand separator, dot as decimal
  assert.strictEqual(toAmountInCents('1,000.50'), 100050);
  assert.strictEqual(toAmountInCents('10,000.99'), 1000099);
  
  // Ambiguous cases with only one separator (last separator wins as decimal)
  assert.strictEqual(toAmountInCents('1000.50'), 100050);
  assert.strictEqual(toAmountInCents('1000,50'), 100050);
});

// Precision and rounding
test('toAmountInCents rounds to nearest cent', () => {
  assert.strictEqual(toAmountInCents(123.454), 12345);
  assert.strictEqual(toAmountInCents(123.455), 12346);
  assert.strictEqual(toAmountInCents(123.456), 12346);
  assert.strictEqual(toAmountInCents('123.454'), 12345);
  assert.strictEqual(toAmountInCents('123.455'), 12346);
});

// Whitespace handling
test('toAmountInCents handles whitespace in strings', () => {
  assert.strictEqual(toAmountInCents('1 234 567,89'), 123456789);
  assert.strictEqual(toAmountInCents('  1234.56  '), 123456);
  assert.strictEqual(toAmountInCents('1 2 3 4'), 1234);
});