import clsx from 'clsx';
import type { ReactNode } from 'react';

export type BadgeVariant = 'pending' | 'sent' | 'converted' | 'error';

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  pending: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40',
  sent: 'bg-sky-500/10 text-sky-200 ring-1 ring-sky-500/40',
  converted: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40',
  error: 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/40',
};

export default function Badge({ children, variant = 'pending', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
