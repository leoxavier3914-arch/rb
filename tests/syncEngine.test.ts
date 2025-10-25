import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runSync, buildDefaultIntervals } from '@/lib/kiwify/syncEngine';
import * as env from '@/lib/env';

vi.mock('@/lib/env', () => ({
  loadEnv: vi.fn(() => ({ SYNC_BUDGET_MS: '20000' }))
}));

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds default intervals for 0, 30 and 90 dias', () => {
    const intervals = buildDefaultIntervals();
    expect(intervals).toHaveLength(3);
  });

  it('increments page when budget disponível', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const result = await runSync({ cursor: { resource: 'products', page: 1, intervalIndex: 0, done: false } });
    expect(result.ok).toBe(true);
    expect(result.nextCursor?.page).toBe(2);
  });

  it('short-circuits when orçamento insuficiente', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Number.MAX_SAFE_INTEGER);
    const result = await runSync({ cursor: { resource: 'products', page: 1, intervalIndex: 0, done: false } });
    expect(result.done).toBe(false);
    expect(result.logs.at(-1)).toContain('Budget insuficiente');
  });
});
