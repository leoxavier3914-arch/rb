import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface EventCardProps {
  title: string;
  subtitle?: string | null;
  amount?: string | null;
  badge?: string | null;
  occurredAt?: string | null;
  meta?: string | null;
  payload?: Record<string, unknown> | null;
}

export function EventCard({
  title,
  subtitle,
  amount,
  badge,
  occurredAt,
  meta,
}: EventCardProps) {
  const relativeTime = occurredAt
    ? formatDistanceToNow(new Date(occurredAt), { locale: ptBR, addSuffix: true })
    : null;

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-surface-accent/40 bg-surface-accent/70 p-6 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-primary-foreground">{title}</h3>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          {meta ? <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{meta}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          {amount ? <span className="text-xl font-semibold text-primary">{amount}</span> : null}
          {badge ? (
            <span className="rounded-full border border-primary/40 bg-primary/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary-foreground">
              {badge}
            </span>
          ) : null}
          {relativeTime ? <span className="text-xs text-muted-foreground">{relativeTime}</span> : null}
        </div>
      </div>
    </article>
  );
}
