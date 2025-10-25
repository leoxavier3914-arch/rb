import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const upsertProductsMock = vi.fn(async (rows: unknown[]) => rows.length);
const upsertSalesMock = vi.fn(async (rows: unknown[]) => rows.length);

vi.mock('@/lib/kiwify/http', () => ({
  kiwifyFetch: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock('@/lib/kiwify/writes', () => ({
  chunk: (arr: unknown[], size: number) => {
    const out: unknown[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  },
  upsertProductsBatch: (...args: unknown[]) => upsertProductsMock(...args),
  upsertSalesBatch: (...args: unknown[]) => upsertSalesMock(...args),
}));

const dateSpy = vi.spyOn(Date, 'now');

beforeEach(() => {
  process.env.KFY_PAGE_SIZE = '1';
  process.env.DB_UPSERT_BATCH = '1';
  process.env.SYNC_BUDGET_MS = '50';
  fetchMock.mockReset();
  upsertProductsMock.mockReset();
  upsertSalesMock.mockReset();
});

afterEach(() => {
  dateSpy.mockReset();
});

describe('runSync', () => {
  it('interrompe processamento quando budget é excedido', async () => {
    let now = 0;
    dateSpy.mockImplementation(() => now);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'p1' }] }), { status: 200 }),
    );

    upsertProductsMock.mockImplementationOnce(async rows => {
      now = 100; // excede budget de 50ms
      return rows.length;
    });

    const { runSync } = await import('@/lib/kiwify/syncEngine');
    const result = await runSync({ cursor: null }, 50);

    expect(result.done).toBe(false);
    expect(result.nextCursor).toEqual({ resource: 'products', page: 1, intervalIndex: 0, done: false });
    expect(upsertProductsMock).toHaveBeenCalledTimes(1);
  });

  it('retorna done=true após percorrer produtos e janelas de vendas', async () => {
    dateSpy.mockImplementation(() => 0);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    const { runSync } = await import('@/lib/kiwify/syncEngine');
    const result = await runSync({ cursor: null }, 1000);

    expect(result.done).toBe(true);
    expect(result.nextCursor).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

