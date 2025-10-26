'use client';

import { Menu, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/ui/classnames';
import { CompactToggle } from './CompactToggle';
import { PeriodPicker } from './PeriodPicker';

interface TopbarProps {
  readonly onToggleSidebar: () => void;
  readonly onOpenCommandMenu: () => void;
}

export function Topbar({ onToggleSidebar, onOpenCommandMenu }: TopbarProps): JSX.Element {
  const [shortcutLabel, setShortcutLabel] = useState<'⌘K' | 'Ctrl+K'>('Ctrl+K');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const isMac = window.navigator.platform.toUpperCase().includes('MAC');
    setShortcutLabel(isMac ? '⌘K' : 'Ctrl+K');
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex rounded-md border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <PeriodPicker />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenCommandMenu}
          className={cn(
            'hidden items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:flex'
          )}
        >
          <Search className="h-4 w-4" aria-hidden />
          <span>Buscar em todo o hub</span>
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">{shortcutLabel}</kbd>
        </button>
        <button
          type="button"
          onClick={onOpenCommandMenu}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
          aria-label="Abrir busca global"
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>
        <CompactToggle />
      </div>
    </header>
  );
}
