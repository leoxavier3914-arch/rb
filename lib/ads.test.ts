import { describe, expect, it } from 'vitest';
import { computeAdPerformance } from './ads';

describe('computeAdPerformance', () => {
  it('detects UTM parameters inside TrackingParameters', () => {
    const rows = [
      {
        id: 'test',
        paid: false,
        status: 'pending',
        traffic_source: 'tiktok.paid',
        payload: {
          TrackingParameters: {
            utm_source: 'tiktok',
            utm_medium: 'paid',
            utm_campaign: 'adstiktok',
          },
        },
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    ];

    const result = computeAdPerformance(rows);
    expect(result).toHaveLength(1);
    expect(result[0].utmSource).toBe('tiktok');
    expect(result[0].utmMedium).toBe('paid');
    expect(result[0].utmCampaign).toBe('adstiktok');
  });
});
