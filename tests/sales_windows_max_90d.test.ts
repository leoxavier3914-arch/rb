import { describe, expect, it } from 'vitest';
import { buildSalesWindows } from '@/lib/kiwify/syncEngine';

const DAY = 24 * 60 * 60 * 1000;

describe('buildSalesWindows', () => {
  it('splits long ranges into contiguous windows with <= 90 days', () => {
    const windows = buildSalesWindows('2024-01-01', '2024-12-31');
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0]?.start).toBe('2024-01-01');
    expect(windows.at(-1)?.end).toBe('2024-12-31');

    for (let index = 0; index < windows.length; index += 1) {
      const current = windows[index]!;
      const start = Date.parse(current.start);
      const end = Date.parse(current.end);
      const diffDays = Math.floor((end - start) / DAY) + 1;
      expect(diffDays).toBeLessThanOrEqual(90);

      if (index > 0) {
        const previousEnd = Date.parse(windows[index - 1]!.end);
        expect(start).toBe(previousEnd + DAY);
      }
    }
  });
});
