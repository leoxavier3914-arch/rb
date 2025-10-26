'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useCompact } from '@/components/providers/CompactProvider';
import { cn } from '@/lib/ui/classnames';

export function CompactToggle() {
  const { compact, toggle } = useCompact();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
        compact && 'border-slate-900 text-slate-900'
      )}
    >
      {compact ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
      <span>Modo compacto</span>
    </button>
  );
}
