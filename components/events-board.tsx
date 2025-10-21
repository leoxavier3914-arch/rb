import Link from "next/link";

import { EventCard, type EventCardProps } from "@/components/event-card";
import { StatCard } from "@/components/stat-card";

interface SummaryStat {
  label: string;
  value: string;
  helper?: string;
}

interface EventFilterValues {
  from?: string;
  to?: string;
  search?: string;
}

interface EventsBoardProps {
  stats: SummaryStat[];
  heading: string;
  description: string;
  emptyState: string;
  events: (EventCardProps & { id: string })[];
  filterAction: string;
  filters: EventFilterValues;
}

export function EventsBoard({
  stats,
  heading,
  description,
  emptyState,
  events,
  filterAction,
  filters,
}: EventsBoardProps) {
  const hasActiveFilters = Boolean(filters.from || filters.to || filters.search);

  return (
    <div className="space-y-10">
      {stats.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} />
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        <header className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-primary-foreground">{heading}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </header>

        <form
          action={filterAction}
          method="get"
          className="flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-4 shadow-soft sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="from" className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Data inicial
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
              className="rounded-xl border border-surface-accent/60 bg-surface px-3 py-2 text-sm text-primary-foreground shadow-inner shadow-black/20 outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="to" className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Data final
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
              className="rounded-xl border border-surface-accent/60 bg-surface px-3 py-2 text-sm text-primary-foreground shadow-inner shadow-black/20 outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="q" className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Buscar registros
            </label>
            <input
              id="q"
              name="q"
              type="search"
              placeholder="Nome, produto, e-mail ou telefone"
              defaultValue={filters.search ?? ""}
              className="rounded-xl border border-surface-accent/60 bg-surface px-3 py-2 text-sm text-primary-foreground shadow-inner shadow-black/20 outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/30 transition-colors hover:bg-primary/90"
            >
              Filtrar
            </button>
            {hasActiveFilters ? (
              <a
                href={filterAction}
                className="rounded-full border border-surface-accent/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Limpar
              </a>
            ) : null}
          </div>
        </form>

        <div className="grid gap-4" role="list">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-accent/50 bg-surface/60 p-10 text-center text-sm text-muted-foreground">
              {emptyState}
            </div>
          ) : (
            events.map(({ id, ...event }) => <EventCard key={id} {...event} />)
          )}
        </div>
      </div>
    </div>
  );
}
