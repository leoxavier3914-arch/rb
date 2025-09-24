import { describe, expect, it } from 'vitest';

import { formatTrafficSourceLabel, getTrafficCategory } from './traffic';

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

describe('formatTrafficSourceLabel', () => {
  it('exibe classificação orgânica, canal e email', () => {
    expect(formatTrafficSourceLabel('tiktok.organic.email')).toBe('Orgânico / TikTok / Email');
  });

  it('exibe canal pago com email', () => {
    expect(formatTrafficSourceLabel('tiktok.paid.email')).toBe('Pago / TikTok / Email');
  });

  it('retorna fallback para origens desconhecidas', () => {
    expect(formatTrafficSourceLabel(null)).toBe('Outros canais');
    expect(formatTrafficSourceLabel('unknown')).toBe('Outros canais');
  });
});
