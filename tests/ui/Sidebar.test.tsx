import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sidebar } from '@/components/shell/Sidebar';
import { resetRouterMocks, setMockPathname } from '../utils/navigationMock';

describe('Sidebar', () => {
  afterEach(() => {
    resetRouterMocks();
    cleanup();
  });

  it('marca o item ativo com base no pathname', () => {
    setMockPathname('/sales');
    render(<Sidebar open={false} onClose={() => {}} />);

    const items = screen.getAllByRole('link', { name: /vendas/i });
    const activeItem = items.find(item => item.className.includes('bg-slate-900'));
    expect(activeItem).toBeDefined();
  });
});
