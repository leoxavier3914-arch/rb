import clsx from 'clsx';
import type { ReactNode } from 'react';

export type BadgeVariant =
  | 'new'
  | 'approved'
  | 'pending'
  | 'abandoned'
  | 'sent'
  | 'converted'
  | 'refunded'
  | 'refused'
  | 'error';

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  new: 'bg-indigo-500/10 text-indigo-200 ring-1 ring-indigo-500/40',
  approved: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40',
  pending: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40',
  abandoned: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40',
  sent: 'bg-sky-500/10 text-sky-200 ring-1 ring-sky-500/40',
  converted: 'bg-lime-500/10 text-lime-200 ring-1 ring-lime-500/40',
  refunded: 'bg-purple-500/10 text-purple-200 ring-1 ring-purple-500/40',
  refused: 'bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/40',
  error: 'bg-slate-500/20 text-slate-200 ring-1 ring-slate-500/40',
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
