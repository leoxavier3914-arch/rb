'use client';

import { cn } from '@/lib/ui/classnames';

export function CardSkeleton({ className }: { readonly className?: string }) {
  return <div className={cn('h-32 w-full animate-pulse rounded-lg bg-slate-200', className)} />;
}

export function TableSkeleton({ rows = 5 }: { readonly rows?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="h-10 w-full bg-slate-200" />
      <div className="divide-y divide-slate-200">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-12 w-full animate-pulse bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-lg border border-slate-200 bg-slate-100" />;
}
