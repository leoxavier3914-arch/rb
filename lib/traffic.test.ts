import { describe, expect, it } from 'vitest';

import { getTrafficCategory } from './traffic';

describe('getTrafficCategory', () => {
  it('classifica tiktok puro como orgânico', () => {
    expect(getTrafficCategory('tiktok')).toBe('organic');
  });

  it('mantém tiktok.paid como canal de anúncio', () => {
    expect(getTrafficCategory('tiktok.paid')).toBe('tiktok');
  });

  it('mantém tiktok utm paid como canal de anúncio', () => {
    expect(getTrafficCategory('tiktok utm paid')).toBe('tiktok');
  });

  it('mantém tiktok organic como orgânico', () => {
    expect(getTrafficCategory('tiktok organic')).toBe('organic');
  });
});
