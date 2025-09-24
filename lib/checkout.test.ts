import { describe, expect, it } from 'vitest';
import { applyManualTrackingToCheckoutUrl } from './checkout';

describe('applyManualTrackingToCheckoutUrl', () => {
  it('adiciona rastreamento manual e parâmetros padrão para links sem UTM', () => {
    const url = 'https://pay.example.com/checkout?foo=bar';

    const result = applyManualTrackingToCheckoutUrl(url, { trafficSource: null });
    const parsed = new URL(result);

    expect(parsed.searchParams.get('rb_manual')).toBe('email');
    expect(parsed.searchParams.get('utm_source')).toBe('manual-email');
    expect(parsed.searchParams.get('utm_medium')).toBe('email');
    expect(parsed.searchParams.get('utm_campaign')).toBe('manual-reminder');
    expect(parsed.searchParams.get('foo')).toBe('bar');
  });

  it('mantém utms existentes e preserva a fonte paga', () => {
    const url = 'https://pay.example.com/checkout?utm_source=tiktok&utm_medium=paid';

    const result = applyManualTrackingToCheckoutUrl(url, { trafficSource: 'tiktok.paid' });
    const parsed = new URL(result);

    expect(parsed.searchParams.get('utm_source')).toBe('tiktok');
    expect(parsed.searchParams.get('utm_medium')).toBe('paid');
    expect(parsed.searchParams.get('utm_campaign')).toBe('manual-reminder');
    expect(parsed.searchParams.get('rb_manual')).toBe('email');
  });

  it('infere canal pago da origem quando não há medium configurado', () => {
    const url = 'https://pay.example.com/checkout';

    const result = applyManualTrackingToCheckoutUrl(url, { trafficSource: 'facebook.paid' });
    const parsed = new URL(result);

    expect(parsed.searchParams.get('utm_source')).toBe('facebook');
    expect(parsed.searchParams.get('utm_medium')).toBe('paid');
    expect(parsed.searchParams.get('rb_manual')).toBe('email');
  });
});
