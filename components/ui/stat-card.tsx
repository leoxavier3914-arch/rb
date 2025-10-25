import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly previousValue?: string;
  readonly deltaPercent?: number | null;
  readonly className?: string;
}

export function StatCard({ label, value, previousValue, deltaPercent, className }: StatCardProps) {
  const delta = typeof deltaPercent === 'number' ? deltaPercent : null;
  const status = delta === null ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        {status === 'up' ? (
          <ArrowUp className="h-4 w-4 text-emerald-500" aria-hidden />
        ) : status === 'down' ? (
          <ArrowDown className="h-4 w-4 text-rose-500" aria-hidden />
        ) : (
          <Minus className="h-4 w-4 text-slate-400" aria-hidden />
        )}
        {delta !== null ? (
          <span className={cn(status === 'down' ? 'text-rose-600' : status === 'up' ? 'text-emerald-600' : 'text-slate-500')}>
            {delta.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%
          </span>
        ) : (
          <span className="text-slate-500">Sem variação</span>
        )}
        {previousValue ? <span className="text-slate-400">vs {previousValue}</span> : null}
      </div>
    </div>
  );
}
