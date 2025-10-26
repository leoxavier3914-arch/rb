import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapCustomerPayload } from '@/lib/kiwify/mappers';

describe('mapCustomerPayload', () => {
  const fixedDate = new Date('2024-01-02T03:04:05.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preenche created_at e updated_at quando ausentes', () => {
    const mapped = mapCustomerPayload({ id: 'cust_123' });

    expect(mapped.created_at).toBe(fixedDate.toISOString());
    expect(mapped.updated_at).toBe(fixedDate.toISOString());
  });

  it('mantém updated_at fornecido no payload', () => {
    const mapped = mapCustomerPayload({ id: 'cust_123', updated_at: '2020-01-01T10:00:00Z' });

    expect(mapped.created_at).toBe(fixedDate.toISOString());
    expect(mapped.updated_at).toBe('2020-01-01T10:00:00.000Z');
  });
});
