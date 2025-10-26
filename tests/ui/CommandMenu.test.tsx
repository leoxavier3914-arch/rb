import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/components/providers/AppProviders';
import { AppShell } from '@/components/shell/AppShell';
import { getMockRouter, resetRouterMocks } from '../utils/navigationMock';

describe('CommandMenu', () => {
  beforeEach(() => {
    resetRouterMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('abre com Cmd/Ctrl+K, busca e navega ao selecionar um item', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { id: 'sale_1', title: 'Venda #1', subtitle: 'Cliente XPTO', type: 'sale' as const }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <AppShell>
          <div>Conteúdo</div>
        </AppShell>
      </AppProviders>
    );

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    window.dispatchEvent(event);

    const input = await screen.findByPlaceholderText(/buscar por venda/i);
    fireEvent.change(input, { target: { value: 'Venda' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toContain('/api/hub/search');

    await screen.findByRole('button', { name: /venda #1/i });

    fireEvent.keyDown(window, { key: 'Enter' });

    const router = getMockRouter();
    expect(router.push).toHaveBeenCalledWith('/sales?id=sale_1');
  });
});
