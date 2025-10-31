'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import SalesVolumeChart, { type SalesVolumePoint } from '@/components/charts/SalesVolumeChart';
import type { DailySalesRow } from '@/lib/sales';
import { formatShortDate } from '@/lib/ui/format';
import { CalendarClock, ChevronDown, ShoppingCart, Wallet2 } from 'lucide-react';

interface SalesVolumePanelProps {
  readonly dailySales: readonly DailySalesRow[];
  readonly currency?: string;
}

type RangeOption =
  | { readonly id: 'all'; readonly label: string; readonly description: string; readonly type: 'all' }
  | { readonly id: 'year' | '6m' | '3m'; readonly label: string; readonly description: string; readonly type: 'months'; readonly months: number }
  | { readonly id: '30d' | '15d' | '7d'; readonly label: string; readonly description: string; readonly type: 'days'; readonly days: number };

interface NormalizedDailyPoint {
  readonly date: Date;
  readonly isoDate: string;
  readonly netAmountCents: number;
  readonly totalSales: number;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

const RANGE_OPTIONS = [
  { id: 'all', label: 'Todo o período', description: 'Todo o período', type: 'all' },
  { id: 'year', label: 'Anual', description: 'Últimos 12 meses', type: 'months', months: 12 },
  { id: '6m', label: '6 meses', description: 'Últimos 6 meses', type: 'months', months: 6 },
  { id: '3m', label: '3 meses', description: 'Últimos 3 meses', type: 'months', months: 3 },
  { id: '30d', label: '30 dias', description: 'Últimos 30 dias', type: 'days', days: 30 },
  { id: '15d', label: '15 dias', description: 'Últimos 15 dias', type: 'days', days: 15 },
  { id: '7d', label: '7 dias', description: 'Últimos 7 dias', type: 'days', days: 7 }
] as const satisfies readonly RangeOption[];

export function SalesVolumePanel({ dailySales, currency = 'BRL' }: SalesVolumePanelProps) {
  const [selectedRange, setSelectedRange] = useState<RangeOption>(RANGE_OPTIONS[0]);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const normalizedDaily = useMemo<NormalizedDailyPoint[]>(() => {
    return dailySales
      .map<NormalizedDailyPoint | null>(item => {
        if (typeof item.saleDate !== 'string' || item.saleDate.length === 0) {
          return null;
        }

        const date = startOfUTCDay(new Date(`${item.saleDate}T00:00:00Z`));
        if (Number.isNaN(date.getTime())) {
          return null;
        }

        const netAmountCents = Math.max(0, typeof item.netAmountCents === 'number' ? item.netAmountCents : Number(item.netAmountCents ?? 0));
        const totalSales = Math.max(0, typeof item.totalSales === 'number' ? item.totalSales : Number(item.totalSales ?? 0));

        return {
          date,
          isoDate: formatISODate(date),
          netAmountCents,
          totalSales
        };
      })
      .filter((value): value is NormalizedDailyPoint => value !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [dailySales]);

  const monthlyTotals = useMemo(() => {
    const totals = new Map<string, { netAmountCents: number; totalSales: number }>();

    for (const point of normalizedDaily) {
      const key = formatMonthKey(point.date);
      const current = totals.get(key) ?? { netAmountCents: 0, totalSales: 0 };

      current.netAmountCents += point.netAmountCents;
      current.totalSales += point.totalSales;

      totals.set(key, current);
    }

    return totals;
  }, [normalizedDaily]);

  const firstDate = normalizedDaily.length > 0 ? normalizedDaily[0].date : null;
  const lastDate = normalizedDaily.length > 0 ? normalizedDaily[normalizedDaily.length - 1].date : null;

  const chartData = useMemo<SalesVolumePoint[]>(() => {
    if (!firstDate || !lastDate) {
      return [];
    }

    if (selectedRange.type === 'all') {
      return buildMonthlyData(monthlyTotals, firstDate, lastDate);
    }

    if (selectedRange.type === 'months') {
      const endMonth = startOfUTCMonth(lastDate);
      const startCandidate = addMonths(endMonth, -(selectedRange.months - 1));
      const firstMonth = startOfUTCMonth(firstDate);
      const startMonth = startCandidate.getTime() < firstMonth.getTime() ? firstMonth : startCandidate;
      return buildMonthlyData(monthlyTotals, startMonth, endMonth);
    }

    const endDate = startOfUTCDay(lastDate);
    const startCandidate = addDays(endDate, -(selectedRange.days - 1));
    const firstDay = startOfUTCDay(firstDate);
    const startDate = startCandidate.getTime() < firstDay.getTime() ? firstDay : startCandidate;
    return buildDailyData(normalizedDaily, startDate, endDate);
  }, [firstDate, lastDate, monthlyTotals, normalizedDaily, selectedRange]);

  const periodDescription = useMemo(() => {
    if (!firstDate || !lastDate) {
      return 'Sem dados disponíveis';
    }

    if (selectedRange.type === 'all') {
      return `Todo o período (desde ${formatShortDate(firstDate)})`;
    }

    return selectedRange.description;
  }, [firstDate, lastDate, selectedRange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) {
        return;
      }
      setMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(current => !current)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0231b1] hover:text-[#0231b1]"
            aria-haspopup="listbox"
            aria-expanded={isMenuOpen}
          >
            <CalendarClock className="h-4 w-4" />
            {selectedRange.label}
            <ChevronDown className={`h-3 w-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isMenuOpen ? (
            <div className="absolute z-10 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
              {RANGE_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedRange(option);
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 font-semibold transition ${
                    option.id === selectedRange.id
                      ? 'bg-[#0231b1]/10 text-[#0231b1]'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-[#0231b1]'
                  }`}
                  role="option"
                  aria-selected={option.id === selectedRange.id}
                >
                  <span>{option.label}</span>
                  {option.id === selectedRange.id ? <span className="text-[10px] uppercase">Ativo</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0231b1] hover:text-[#0231b1]"
        >
          <Wallet2 className="h-4 w-4" />
          Todas as moedas
        </button>

        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-[#0231b1] hover:text-[#0231b1]"
        >
          <ShoppingCart className="h-4 w-4" />
          Todos os produtos
        </button>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-[#0f5ef7]/10 via-white to-white p-6">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Volume de vendas</span>
          <span>{periodDescription}</span>
        </div>
        <div className="mt-4 h-56 w-full">
          <SalesVolumeChart data={chartData} currency={currency} />
        </div>
      </div>
    </div>
  );
}

export default SalesVolumePanel;

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUTCMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function addMonths(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(date: Date): string {
  return `${MONTH_LABELS[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`;
}

const dayLabelFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

function formatDayLabel(date: Date): string {
  return dayLabelFormatter.format(date);
}

function buildMonthlyData(
  monthlyTotals: Map<string, { netAmountCents: number; totalSales: number }>,
  startMonth: Date,
  endMonth: Date
): SalesVolumePoint[] {
  const start = startOfUTCMonth(startMonth);
  const end = startOfUTCMonth(endMonth);

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const result: SalesVolumePoint[] = [];

  for (let current = start; current.getTime() <= end.getTime(); current = addMonths(current, 1)) {
    const key = formatMonthKey(current);
    const totals = monthlyTotals.get(key);

    result.push({
      month: key,
      label: formatMonthLabel(current),
      netAmount: totals ? Math.max(0, totals.netAmountCents) / 100 : 0,
      totalSales: totals ? Math.max(0, totals.totalSales) : 0
    });
  }

  return result;
}

function buildDailyData(
  dailyPoints: readonly NormalizedDailyPoint[],
  startDate: Date,
  endDate: Date
): SalesVolumePoint[] {
  const start = startOfUTCDay(startDate);
  const end = startOfUTCDay(endDate);

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const byDay = new Map<string, NormalizedDailyPoint>();
  for (const point of dailyPoints) {
    byDay.set(point.isoDate, point);
  }

  const result: SalesVolumePoint[] = [];

  for (let current = start; current.getTime() <= end.getTime(); current = addDays(current, 1)) {
    const isoDate = formatISODate(current);
    const totals = byDay.get(isoDate);

    result.push({
      month: isoDate,
      label: formatDayLabel(current),
      netAmount: totals ? Math.max(0, totals.netAmountCents) / 100 : 0,
      totalSales: totals ? Math.max(0, totals.totalSales) : 0
    });
  }

  return result;
}
