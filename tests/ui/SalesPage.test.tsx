import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/components/providers/AppProviders';
import SalesPage from '@/app/(app)/sales/page';

describe('SalesPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('lista vendas e permite abrir os detalhes pela tabela', async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const formatDateInput = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const ninetyDayWindowMs = (90 - 1) * 24 * 60 * 60 * 1000;
    const defaultEndDate = formatDateInput(now);
    const defaultStartDate = formatDateInput(new Date(now.getTime() - ninetyDayWindowMs));
    const fetchMock = vi.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;

      if (url.includes('/api/kfy/sales?')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: [
              {
                id: 'sale_1',
                customer_name: 'Cliente Teste',
                status: 'paid',
                total_amount_cents: 120000,
                paid_at: nowIso
              }
            ]
          })
        });
      }

      if (url.includes('/api/kfy/sales/sale_1')) {
        expect(init?.method ?? 'GET').toBe('GET');
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: {
              id: 'sale_1',
              status: 'paid',
              total_amount_cents: 120000,
              net_amount_cents: 100000,
              fee_amount_cents: 20000,
              customer_id: 'cust_1',
              product_id: 'prod_1',
              created_at: nowIso,
              paid_at: nowIso,
              updated_at: nowIso
            }
          })
        });
      }

      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, data: null }) });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <SalesPage />
      </AppProviders>
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/kfy/sales?'), expect.anything())
    );

    const listCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : input.url;
      return url.includes('/api/kfy/sales?');
    });

    expect(listCall).toBeDefined();
    const listUrl = typeof listCall![0] === 'string' ? listCall![0] : listCall![0].url;
    expect(listUrl).toContain(`start_date=${defaultStartDate}`);
    expect(listUrl).toContain(`end_date=${defaultEndDate}`);
    expect(listUrl).not.toContain('page=');

    await screen.findByText('Cliente Teste');

    fireEvent.click(screen.getByText('Cliente Teste'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/kfy/sales/sale_1'), expect.anything()));

    await screen.findByText('prod_1');
  });
});
