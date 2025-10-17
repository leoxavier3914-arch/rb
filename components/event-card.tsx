import Link from "next/link";
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
  details?: { label: string; value: string }[];
  href?: string | null;
}

const buildMetaLink = (value: string) => {
  try {
    return new URL(value);
  } catch (error) {
    try {
      return new URL(`https://${value}`);
    } catch (innerError) {
      return null;
    }
  }
};

const formatMetaDisplay = (value: string, link: URL | null) => {
  if (!link) {
    return value;
  }

  const path = link.pathname.replace(/\/$/, "");
  return `${link.host}${path}` || link.host;
};

export function EventCard({
  title,
  subtitle,
  amount,
  badge,
  occurredAt,
  meta,
  details = [],
  href,
}: EventCardProps) {
  const relativeTime = occurredAt
    ? formatDistanceToNow(new Date(occurredAt), { locale: ptBR, addSuffix: true })
    : null;

  const normalizedMeta = typeof meta === "string" ? meta.trim() : meta ?? null;
  const metaLink = !href && normalizedMeta ? buildMetaLink(normalizedMeta) : null;
  const metaHref = metaLink?.href;
  const metaDisplay = normalizedMeta ? formatMetaDisplay(normalizedMeta, metaLink) : null;
  const hasDetails = Array.isArray(details) && details.length > 0;

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-surface-accent/40 bg-surface-accent/70 p-6 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-primary-foreground">{title}</h3>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          {metaDisplay ? (
            href ? (
              <Link
                href={href}
                title={normalizedMeta ?? undefined}
                className="inline-flex max-w-full items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:text-primary-foreground"
              >
                {metaDisplay}
              </Link>
            ) : metaHref ? (
              <a
                href={metaHref}
                target="_blank"
                rel="noreferrer"
                title={normalizedMeta ?? undefined}
                className="inline-flex max-w-full items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:text-primary-foreground"
              >
                {metaDisplay}
              </a>
            ) : (
              <p
                title={normalizedMeta ?? undefined}
                className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs uppercase tracking-[0.3em] text-muted-foreground/80"
              >
                {metaDisplay}
              </p>
            )
          ) : null}
          {hasDetails ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
              {details.map((detail, index) => (
                <div key={`${detail.label}-${detail.value}-${index}`} className="flex gap-1">
                  <dt className="font-medium text-muted-foreground/80">{detail.label}:</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
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
