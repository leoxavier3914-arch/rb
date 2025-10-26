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

  it('salva a visão atual como favorito', async () => {
    const fetchMock = vi.fn((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/hub/sales')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            items: [
              {
                id: 'sale_1',
                customer: 'Cliente Teste',
                status: 'paid',
                total_cents: 120000,
                created_at: new Date().toISOString()
              }
            ]
          })
        });
      }
      if (url.includes('/api/hub/views')) {
        expect(init?.method).toBe('POST');
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <SalesPage />
      </AppProviders>
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /salvar como favorito/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /salvar como favorito/i }));

    await waitFor(() => expect(screen.getByText(/visão salva com sucesso/i)).toBeInTheDocument());
  });
});
