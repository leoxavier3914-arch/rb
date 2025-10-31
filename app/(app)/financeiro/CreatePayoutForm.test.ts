import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Tests for CreatePayoutForm component logic
 * 
 * These tests validate the business logic and data transformations used in the form.
 * Since the project uses Node.js test runner without React testing libraries,
 * we test the core logic separately from the React component.
 * 
 * For full UI testing, consider adding @testing-library/react or similar.
 */

// Helper function that mimics the form's amount normalization logic
function normalizeAmount(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  return Number.parseFloat(normalized);
}

// Helper function that mimics the form's validation logic
function validateAmount(value: string): { valid: boolean; error?: string } {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const amountNumber = Number.parseFloat(normalized);
  
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return { valid: false, error: 'Informe um valor válido em reais.' };
  }
  
  return { valid: true };
}

// Helper function that checks if amount exceeds available balance
function validateBalance(amountCents: number, availableCents: number): { valid: boolean; error?: string } {
  if (availableCents <= 0) {
    return { valid: false, error: 'Não há saldo disponível para solicitar saque no momento.' };
  }
  
  if (amountCents > availableCents) {
    return { valid: false, error: 'O valor solicitado excede o saldo disponível.' };
  }
  
  return { valid: true };
}

// Tests for amount normalization
test('normalizeAmount converts Brazilian format to decimal', () => {
  assert.strictEqual(normalizeAmount('123,45'), 123.45);
  assert.strictEqual(normalizeAmount('1.234,56'), 1234.56);
  assert.strictEqual(normalizeAmount('100,00'), 100);
});

test('normalizeAmount handles values without decimal separator', () => {
  assert.strictEqual(normalizeAmount('123'), 123);
  assert.strictEqual(normalizeAmount('1000'), 1000);
});

test('normalizeAmount handles thousand separators', () => {
  assert.strictEqual(normalizeAmount('1.000,00'), 1000);
  assert.strictEqual(normalizeAmount('10.000,50'), 10000.5);
  assert.strictEqual(normalizeAmount('100.000'), 100000);
});

// Tests for amount validation
test('validateAmount accepts valid positive amounts', () => {
  assert.deepStrictEqual(validateAmount('100,00'), { valid: true });
  assert.deepStrictEqual(validateAmount('1.234,56'), { valid: true });
  assert.deepStrictEqual(validateAmount('0,01'), { valid: true });
  assert.deepStrictEqual(validateAmount('999999,99'), { valid: true });
});

test('validateAmount rejects zero', () => {
  const result = validateAmount('0,00');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Informe um valor válido em reais.');
});

test('validateAmount rejects negative amounts', () => {
  const result = validateAmount('-100,00');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Informe um valor válido em reais.');
});

test('validateAmount rejects empty strings', () => {
  const result = validateAmount('');
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Informe um valor válido em reais.');
});

test('validateAmount rejects invalid formats', () => {
  assert.strictEqual(validateAmount('abc').valid, false);
  assert.strictEqual(validateAmount('12.34.56').valid, false);
  assert.strictEqual(validateAmount('R$ 100,00').valid, false);
});

// Tests for balance validation
test('validateBalance accepts amount within available balance', () => {
  assert.deepStrictEqual(validateBalance(10000, 15000), { valid: true });
  assert.deepStrictEqual(validateBalance(15000, 15000), { valid: true });
  assert.deepStrictEqual(validateBalance(1, 100), { valid: true });
});

test('validateBalance rejects amount exceeding available balance', () => {
  const result = validateBalance(20000, 15000);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'O valor solicitado excede o saldo disponível.');
});

test('validateBalance rejects when no balance available', () => {
  const result1 = validateBalance(10000, 0);
  assert.strictEqual(result1.valid, false);
  assert.strictEqual(result1.error, 'Não há saldo disponível para solicitar saque no momento.');
  
  const result2 = validateBalance(1, -100);
  assert.strictEqual(result2.valid, false);
  assert.strictEqual(result2.error, 'Não há saldo disponível para solicitar saque no momento.');
});

test('validateBalance allows withdrawal when balance is positive', () => {
  assert.deepStrictEqual(validateBalance(100, 100), { valid: true });
  assert.deepStrictEqual(validateBalance(99, 100), { valid: true });
});

// Integration tests combining multiple validations
test('complete validation flow for valid input with sufficient balance', () => {
  const input = '150,00';
  const availableCents = 20000; // R$ 200,00
  
  const amountValidation = validateAmount(input);
  assert.strictEqual(amountValidation.valid, true);
  
  const normalized = normalizeAmount(input);
  const amountCents = Math.round(normalized * 100);
  assert.strictEqual(amountCents, 15000);
  
  const balanceValidation = validateBalance(amountCents, availableCents);
  assert.strictEqual(balanceValidation.valid, true);
});

test('complete validation flow rejects amount exceeding balance', () => {
  const input = '250,00';
  const availableCents = 20000; // R$ 200,00
  
  const amountValidation = validateAmount(input);
  assert.strictEqual(amountValidation.valid, true);
  
  const normalized = normalizeAmount(input);
  const amountCents = Math.round(normalized * 100);
  assert.strictEqual(amountCents, 25000);
  
  const balanceValidation = validateBalance(amountCents, availableCents);
  assert.strictEqual(balanceValidation.valid, false);
  assert.strictEqual(balanceValidation.error, 'O valor solicitado excede o saldo disponível.');
});

test('complete validation flow rejects invalid amount format', () => {
  const input = 'invalid';
  
  const amountValidation = validateAmount(input);
  assert.strictEqual(amountValidation.valid, false);
  assert.strictEqual(amountValidation.error, 'Informe um valor válido em reais.');
});

test('complete validation flow rejects when no balance available', () => {
  const input = '10,00';
  const availableCents = 0;
  
  const amountValidation = validateAmount(input);
  assert.strictEqual(amountValidation.valid, true);
  
  const normalized = normalizeAmount(input);
  const amountCents = Math.round(normalized * 100);
  
  const balanceValidation = validateBalance(amountCents, availableCents);
  assert.strictEqual(balanceValidation.valid, false);
  assert.strictEqual(balanceValidation.error, 'Não há saldo disponível para solicitar saque no momento.');
});

// Edge cases for cents conversion
test('cents conversion handles rounding correctly', () => {
  const testCases = [
    { input: '100,50', expectedCents: 10050 },
    { input: '100,505', expectedCents: 10051 }, // Rounds up
    { input: '100,504', expectedCents: 10050 }, // Rounds down
    { input: '0,01', expectedCents: 1 },
    { input: '0,99', expectedCents: 99 },
    { input: '1,00', expectedCents: 100 }
  ];
  
  for (const { input, expectedCents } of testCases) {
    const normalized = normalizeAmount(input);
    const cents = Math.round(normalized * 100);
    assert.strictEqual(cents, expectedCents, `Failed for input: ${input}`);
  }
});

// Tests for edge cases in thousand separators
test('normalizeAmount handles multiple thousand separators', () => {
  assert.strictEqual(normalizeAmount('1.000.000,00'), 1000000);
  assert.strictEqual(normalizeAmount('10.000.000,50'), 10000000.5);
});

test('normalizeAmount handles edge case with only thousand separators', () => {
  // "1.000" should be treated as 1000 (no decimal part)
  assert.strictEqual(normalizeAmount('1.000'), 1000);
  assert.strictEqual(normalizeAmount('10.000'), 10000);
});

// Tests for button disable state logic
test('button should be disabled when no balance available', () => {
  const hasAvailableBalance = false;
  const state = 'idle';
  const shouldBeDisabled = state === 'loading' || !hasAvailableBalance;
  
  assert.strictEqual(shouldBeDisabled, true);
});

test('button should be disabled when loading', () => {
  const hasAvailableBalance = 10000 > 0;
  const state = 'loading';
  const shouldBeDisabled = state === 'loading' || !hasAvailableBalance;
  
  assert.strictEqual(shouldBeDisabled, true);
});

test('button should be enabled when idle with available balance', () => {
  const hasAvailableBalance = 10000 > 0;
  const state = 'idle';
  const shouldBeDisabled = state === 'loading' || !hasAvailableBalance;
  
  assert.strictEqual(shouldBeDisabled, false);
});

// Tests for API payload construction
test('API request payload is constructed correctly', () => {
  const input = '123,45';
  const normalized = normalizeAmount(input);
  const amountCents = Math.round(normalized * 100);
  
  const payload = { amount: amountCents };
  
  assert.deepStrictEqual(payload, { amount: 12345 });
});

test('API request payload handles large amounts', () => {
  const input = '9.999,99';
  const normalized = normalizeAmount(input);
  const amountCents = Math.round(normalized * 100);
  
  const payload = { amount: amountCents };
  
  assert.deepStrictEqual(payload, { amount: 999999 });
});

test('API request payload handles minimum amount', () => {
  const input = '0,01';
  const normalized = normalizeAmount(input);
  const amountCents = Math.round(normalized * 100);
  
  const payload = { amount: amountCents };
  
  assert.deepStrictEqual(payload, { amount: 1 });
});