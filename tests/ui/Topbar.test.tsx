import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppProviders } from '@/components/providers/AppProviders';
import { Topbar } from '@/components/shell/Topbar';

describe('Topbar', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('altera o período global e persiste no localStorage', () => {
    render(
      <AppProviders>
        <Topbar onToggleSidebar={() => {}} onOpenCommandMenu={() => {}} />
      </AppProviders>
    );

    const button30 = screen.getByRole('button', { name: /30d/i });
    fireEvent.click(button30);

    expect(window.localStorage.getItem('rb.period')).toBe('30');
  });
});
