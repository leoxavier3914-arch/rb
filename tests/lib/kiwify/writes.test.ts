import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsertSpy = vi.fn(async () => ({ error: null, count: 3 }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: upsertSpy,
    }),
  }),
}));

describe('writes', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.MAX_WRITE_MS = '100';
    upsertSpy.mockClear();
  });

  it('executa upsert único por lote', async () => {
    const { upsertProductsBatch } = await import('@/lib/kiwify/writes');
    const rows = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const count = await upsertProductsBatch(rows);

    expect(count).toBe(3);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(rows, expect.objectContaining({ onConflict: 'id' }));
  });

  it('divide array em pedaços com chunk()', async () => {
    const { chunk } = await import('@/lib/kiwify/writes');
    const result = chunk([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([[1, 2], [3, 4], [5]]);
  });
});

