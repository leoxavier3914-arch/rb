import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveStatus } from './abandonedCarts';

describe('resolveStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'abandoned' for carts stuck as new after an hour without payment", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T02:00:00.000Z'));

    const status = resolveStatus({
      normalizedStatuses: ['new'],
      paid: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    });

    expect(status).toBe('abandoned');
  });
});
