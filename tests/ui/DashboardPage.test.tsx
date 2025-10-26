import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/components/providers/AppProviders';
import DashboardPage from '@/app/(app)/dashboard/page';

describe('DashboardPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('exibe métricas com deltas quando compare=true', async () => {
    const fetchMock = vi.fn((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/hub/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            compare: true,
            period: { from: new Date().toISOString(), to: new Date().toISOString() },
            metrics: [
              {
                id: 'revenue',
                label: 'Receita',
                format: 'currency' as const,
                current: 600000,
                previous: 300000
              }
            ]
          })
        });
      }
      if (url.includes('/api/hub/top-products')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            products: [
              { id: 'prod_1', title: 'Curso Avançado', revenue_cents: 900000, total_sales: 15 }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <DashboardPage />
      </AppProviders>
    );

    const headers = await screen.findAllByText(/receita/i);
    expect(headers.length).toBeGreaterThan(0);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/curso avançado/i)).toBeInTheDocument();
  });
});
