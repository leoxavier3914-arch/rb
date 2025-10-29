import { cn } from '@/lib/ui/classnames';

const STATUS_DETAILS: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  waiting_payment: {
    label: 'Aguardando pagamento',
    badgeClass: 'bg-amber-100 text-amber-700',
    dotClass: 'bg-amber-500'
  },
  pending_payment: {
    label: 'Pagamento em análise',
    badgeClass: 'bg-sky-100 text-sky-700',
    dotClass: 'bg-sky-500'
  }
};

interface PendingStatusBadgeProps {
  readonly status: string | null;
}

export function PendingStatusBadge({ status }: PendingStatusBadgeProps) {
  const normalized = typeof status === 'string' ? status : 'unknown';
  const detail = STATUS_DETAILS[normalized] ?? {
    label: 'Status desconhecido',
    badgeClass: 'bg-slate-100 text-slate-600',
    dotClass: 'bg-slate-400'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium capitalize',
        detail.badgeClass
      )}
    >
      <span className={cn('size-1.5 rounded-full', detail.dotClass)} aria-hidden />
      {detail.label}
    </span>
  );
}
