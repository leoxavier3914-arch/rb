'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Calendar } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePeriod } from '@/components/providers/PeriodProvider';
import { cn } from '@/lib/ui/classnames';
import { formatShortDate } from '@/lib/ui/format';
import type { PeriodPreset } from '@/lib/ui/date';

const PRESETS: PeriodPreset[] = [7, 30, 90];

function formatInputDate(value: string): string {
  return value.slice(0, 10);
}

export function PeriodPicker() {
  const { preset, range, setPreset, setCustom, isPreset } = usePeriod();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [from, setFrom] = useState(formatInputDate(range.from));
  const [to, setTo] = useState(formatInputDate(range.to));

  useEffect(() => {
    setFrom(formatInputDate(range.from));
    setTo(formatInputDate(range.to));
  }, [range.from, range.to]);

  const rangeLabel = useMemo(() => {
    if (isPreset && preset) {
      return `${preset} dias`;
    }
    return `${formatShortDate(range.from)} — ${formatShortDate(range.to)}`;
  }, [isPreset, preset, range.from, range.to]);

  const applyCustom = (): void => {
    if (!from || !to) {
      return;
    }
    const fromIso = new Date(from).toISOString();
    const toIso = new Date(to).toISOString();
    setCustom(fromIso, toIso);
    setDialogOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {PRESETS.map(value => (
          <button
            type="button"
            key={value}
            onClick={() => setPreset(value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium transition',
              preset === value && isPreset
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            {value}d
          </button>
        ))}
      </div>
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
              !isPreset && 'border-slate-900 text-slate-900'
            )}
          >
            <Calendar className="h-4 w-4" aria-hidden />
            Custom
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <Dialog.Title className="text-lg font-semibold text-slate-900">Selecionar intervalo</Dialog.Title>
            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                De
                <input
                  type="date"
                  value={from}
                  onChange={event => setFrom(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Até
                <input
                  type="date"
                  value={to}
                  onChange={event => setTo(event.target.value)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  Cancelar
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={applyCustom}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Aplicar
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <span className="hidden text-xs text-slate-500 sm:inline">{rangeLabel}</span>
    </div>
  );
}
