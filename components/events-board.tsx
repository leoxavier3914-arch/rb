"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

const dayNumberFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthKey = (value: Date) => `${value.getFullYear()}-${value.getMonth()}`;

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthPickerRef = useRef<HTMLDivElement | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const today = useMemo(() => {
    const reference = new Date();
    reference.setHours(0, 0, 0, 0);
    return reference;
  }, []);

  const selectedDateValue =
    filters.from && filters.to && filters.from === filters.to
      ? filters.from
      : filters.from ?? filters.to;

  const selectedDate = useMemo(() => {
    return selectedDateValue ? new Date(`${selectedDateValue}T00:00:00`) : undefined;
  }, [selectedDateValue]);

  const resolvedSelectedDate = selectedDate ?? today;

  const initialMonth = useMemo(() => {
    const base = new Date(resolvedSelectedDate);
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    return base;
  }, [resolvedSelectedDate]);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  const initialMonthKey = useMemo(() => getMonthKey(initialMonth), [initialMonth]);

  useEffect(() => {
    setCurrentMonth(initialMonth);
  }, [initialMonth, initialMonthKey]);

  useEffect(() => {
    if (!isMonthPickerOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!monthPickerRef.current) {
        return;
      }

      if (!monthPickerRef.current.contains(event.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMonthPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMonthPickerOpen]);

  const dayOptions = useMemo(() => {
    const year = currentMonth.getFullYear();
    const monthIndex = currentMonth.getMonth();
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();

    return Array.from({ length: totalDays }, (_, index) => {
      const option = new Date(year, monthIndex, index + 1);
      option.setHours(0, 0, 0, 0);
      return option;
    });
  }, [currentMonth]);

  const makeDayHref = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("from", value);
      params.set("to", value);

      return `${filterAction}?${params.toString()}`;
    },
    [filterAction, searchParams],
  );

  const navigateToMonth = useCallback(
    (monthDate: Date) => {
      const monthStart = new Date(monthDate);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const selectedDay = selectedDate?.getDate() ?? 1;
      const lastDayOfMonth = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        0,
      ).getDate();

      const resolvedDay = Math.min(selectedDay, lastDayOfMonth);
      const nextDate = new Date(monthStart);
      nextDate.setDate(resolvedDay);
      nextDate.setHours(0, 0, 0, 0);

      const targetValue = toDateInputValue(nextDate);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("from", targetValue);
      params.set("to", targetValue);

      setCurrentMonth(monthStart);
      setIsMonthPickerOpen(false);
      router.push(`${filterAction}?${params.toString()}`, { scroll: false });
    },
    [filterAction, router, searchParams, selectedDate],
  );

  const handleMonthInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (!value) {
        return;
      }

      const [year, month] = value.split("-").map((part) => Number.parseInt(part, 10));
      if (Number.isNaN(year) || Number.isNaN(month)) {
        return;
      }

      navigateToMonth(new Date(year, month - 1, 1));
    },
    [navigateToMonth],
  );

  const handleMonthStep = useCallback(
    (offset: number) => {
      const next = new Date(currentMonth);
      next.setMonth(currentMonth.getMonth() + offset, 1);
      navigateToMonth(next);
    },
    [currentMonth, navigateToMonth],
  );

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
          <div className="space-y-3 rounded-3xl border border-surface-accent/40 bg-surface-accent/70 p-6 transition-colors">
            <div className="flex items-center justify-center gap-2 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-base">
              <div className="relative" ref={monthPickerRef}>
                <button
                  type="button"
                  onClick={() => setIsMonthPickerOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-transparent bg-transparent px-4 py-1.5 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  aria-haspopup="dialog"
                  aria-expanded={isMonthPickerOpen}
                >
                  {monthYearFormatter.format(currentMonth)}
                </button>
                {isMonthPickerOpen ? (
                  <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-2xl border border-surface-accent/60 bg-surface p-3 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleMonthStep(-1)}
                        className="rounded-full border border-surface-accent/50 bg-surface px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMonthStep(1)}
                        className="rounded-full border border-surface-accent/50 bg-surface px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        Próximo
                      </button>
                    </div>
                    <div className="pt-3">
                      <label className="flex flex-col items-center gap-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Escolher mês
                        <input
                          type="month"
                          value={`${currentMonth.getFullYear()}-${`${currentMonth.getMonth() + 1}`.padStart(2, "0")}`}
                          onChange={handleMonthInputChange}
                          className="rounded-xl border border-surface-accent/60 bg-surface px-3 py-2 text-sm text-primary-foreground outline-none transition-colors focus:border-primary"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="-mx-6 overflow-x-auto px-6 pb-4">
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
        </div>

        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} />
        ))}
      </div>

      <div className="space-y-4">
        <header className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-xl font-semibold text-primary-foreground">{heading}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </header>

        <form
          action={filterAction}
          method="get"
          className="space-y-5 rounded-3xl border border-surface-accent/40 bg-surface-accent/70 p-6 transition-colors"
        >
          {selectedDateValue ? (
            <>
              <input type="hidden" name="from" value={selectedDateValue} />
              <input type="hidden" name="to" value={selectedDateValue} />
            </>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="q"
                className="self-center text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                Buscar registros
              </label>
              <input
                id="q"
                name="q"
                type="search"
                placeholder="Nome, produto, e-mail ou telefone"
                defaultValue={filters.search ?? ""}
                className="rounded-xl border border-surface-accent/60 bg-surface px-3 py-2 text-sm text-primary-foreground shadow-inner shadow-black/20 outline-none transition-colors focus:border-primary"
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
