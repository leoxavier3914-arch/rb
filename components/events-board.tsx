import Link from "next/link";

import clsx from "clsx";

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const dayCount = 30;
  let dayOptions = Array.from({ length: dayCount }, (_, index) => {
    const option = new Date(today);
    option.setDate(today.getDate() - index);
    option.setHours(0, 0, 0, 0);
    return option;
  });

  const selectedDateValue =
    filters.from && filters.to && filters.from === filters.to
      ? filters.from
      : filters.from ?? filters.to;
  const selectedDate = selectedDateValue
    ? new Date(`${selectedDateValue}T00:00:00`)
    : undefined;
  const resolvedSelectedDate = selectedDate ?? today;

  if (selectedDate && !dayOptions.some((option) => toDateInputValue(option) === selectedDateValue)) {
    dayOptions = [selectedDate, ...dayOptions].sort((a, b) => b.getTime() - a.getTime());
  }

  const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const dayNumberFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
  const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

  const makeDayHref = (value: string) => {
    const params = new URLSearchParams();
    params.set("from", value);
    params.set("to", value);
    if (filters.search) {
      params.set("q", filters.search);
    }

    return `${filterAction}?${params.toString()}`;
  };

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
          className="space-y-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-4 shadow-soft"
        >
          {selectedDateValue ? (
            <>
              <input type="hidden" name="from" value={selectedDateValue} />
              <input type="hidden" name="to" value={selectedDateValue} />
            </>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                Buscar
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
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {monthYearFormatter.format(resolvedSelectedDate)}
            </p>
            <div className="-mx-4 overflow-x-auto px-4">
              <div className="flex gap-2 pb-1">
                {dayOptions.map((option) => {
                  const optionValue = toDateInputValue(option);
                  const isActive = optionValue === selectedDateValue;

                  return (
                    <Link
                      key={optionValue}
                      href={makeDayHref(optionValue)}
                      scroll={false}
                      className={clsx(
                        "flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center",
                        "transition-colors",
                        isActive
                          ? "border-primary bg-primary/15 text-primary-foreground"
                          : "border-surface-accent/60 bg-surface/80 text-muted-foreground hover:border-primary hover:text-primary",
                      )}
                    >
                      <span
                        className={clsx(
                          "text-[0.65rem] font-semibold uppercase tracking-[0.2em]",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
                      >
                        {weekdayFormatter.format(option)}
                      </span>
                      <span
                        className={clsx(
                          "text-lg font-semibold",
                          isActive ? "text-primary-foreground" : "text-primary-foreground/80",
                        )}
                      >
                        {dayNumberFormatter.format(option)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
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
