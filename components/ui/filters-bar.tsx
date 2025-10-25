import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface FiltersBarProps {
  readonly title: string;
  readonly children?: React.ReactNode;
  readonly onReset?: () => void;
  readonly actions?: React.ReactNode;
  readonly className?: string;
}

export function FiltersBar({ title, children, onReset, actions, className }: FiltersBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase text-slate-500">{title}</h2>
        {children ? <div className="flex flex-wrap gap-2 text-sm text-slate-600">{children}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {onReset ? (
          <Button variant="ghost" size="sm" onClick={onReset} type="button">
            Limpar filtros
          </Button>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
