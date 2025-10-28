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
    const now = new Date().toISOString();
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
                paid_at: now
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
              created_at: now,
              paid_at: now,
              updated_at: now
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

    const [startInput] = screen.getAllByLabelText(/data de início/i);
    const [endInput] = screen.getAllByLabelText(/data de fim/i);

    fireEvent.change(startInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endInput, { target: { value: '2024-01-31' } });

    const submitButton = await screen.findByRole('button', { name: /aplicar filtros/i });
    fireEvent.click(submitButton);

    await screen.findByText('Cliente Teste');

    fireEvent.click(screen.getByText('Cliente Teste'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/kfy/sales/sale_1'), expect.anything()));

    await screen.findByText('prod_1');
  });
});
