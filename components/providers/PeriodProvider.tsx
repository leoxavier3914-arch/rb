'use client';

import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@/lib/ui/useLocalStorage';
import { getPresetRange, isPresetPeriod, normalizeCustomPeriod, type CustomPeriod, type PeriodPreset, type PeriodValue } from '@/lib/ui/date';

type PeriodContextValue = {
  readonly period: PeriodValue;
  readonly isPreset: boolean;
  readonly preset: PeriodPreset | null;
  readonly range: CustomPeriod;
  readonly setPreset: (preset: PeriodPreset) => void;
  readonly setCustom: (from: string, to: string) => void;
};

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

export function PeriodProvider({ children }: { readonly children: React.ReactNode }): JSX.Element {
  const [period, setPeriod] = useLocalStorage<PeriodValue>('rb.period', 7);

  const value = useMemo<PeriodContextValue>(() => {
    const isPreset = isPresetPeriod(period);
    const preset = isPreset ? period : null;
    const range = isPreset ? getPresetRange(period) : normalizeCustomPeriod(period);

    return {
      period,
      isPreset,
      preset,
      range,
      setPreset: (nextPreset: PeriodPreset) => {
        setPeriod(nextPreset);
      },
      setCustom: (from: string, to: string) => {
        setPeriod(normalizeCustomPeriod({ from, to }));
      }
    };
  }, [period, setPeriod]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const context = useContext(PeriodContext);
  if (!context) {
    throw new Error('usePeriod deve ser usado dentro de PeriodProvider');
  }
  return context;
}
