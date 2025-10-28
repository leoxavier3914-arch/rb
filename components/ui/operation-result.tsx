'use client';

import { cn } from '@/lib/ui/classnames';

interface OperationResultProps {
  readonly loading: boolean;
  readonly error: string | null;
  readonly data: unknown;
  readonly className?: string;
}

export function OperationResult({ loading, error, data, className }: OperationResultProps) {
  if (loading) {
    return <p className={cn('text-sm text-slate-500', className)}>Executando operação…</p>;
  }

  if (error) {
    return <p className={cn('text-sm text-red-600', className)}>{error}</p>;
  }

  if (data === null || data === undefined) {
    return null;
  }

  return (
    <pre className={cn('mt-4 max-h-80 overflow-y-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100', className)}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
