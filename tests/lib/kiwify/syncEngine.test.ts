import { describe, expect, it } from 'vitest';
import { parsePage } from '@/lib/kiwify/syncEngine';

describe('parsePage', () => {
  it('returns items from resource-specific arrays', () => {
    const payload = {
      sales: [
        {
          id: 'sale_1',
          total_amount: 100
        }
      ],
      meta: { pagination: { current_page: 1, total_pages: 1 } }
    } satisfies Record<string, unknown>;

    const result = parsePage(payload, 'sales', 1);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextPage).toBeNull();
  });

  it('finds nested arrays in data containers', () => {
    const payload = {
      data: {
        data: {
          sales: [
            {
              id: 'sale_2',
              total_amount: 200
            }
          ]
        }
      },
      meta: { pagination: { current_page: 2, total_pages: 3 } }
    } satisfies Record<string, unknown>;

    const result = parsePage(payload, 'sales', 2);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextPage).toBe(3);
  });
});
