'use client';

import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@/lib/ui/useLocalStorage';

type CompactContextValue = {
  readonly compact: boolean;
  readonly toggle: () => void;
  readonly setCompact: (value: boolean) => void;
};

const CompactContext = createContext<CompactContextValue | undefined>(undefined);

export function CompactProvider({ children }: { readonly children: React.ReactNode }) {
  const [compact, setCompactState] = useLocalStorage<boolean>('rb.compact', false, {
    serializer: value => JSON.stringify(value),
    deserializer: value => value === 'true' || value === 'false' ? value === 'true' : JSON.parse(value) as boolean
  });

  const value = useMemo<CompactContextValue>(
    () => ({
      compact,
      toggle: () => setCompactState(current => !current),
      setCompact: (next: boolean) => setCompactState(next)
    }),
    [compact, setCompactState]
  );

  return <CompactContext.Provider value={value}>{children}</CompactContext.Provider>;
}

export function useCompact(): CompactContextValue {
  const context = useContext(CompactContext);
  if (!context) {
    throw new Error('useCompact deve ser usado dentro de CompactProvider');
  }
  return context;
}
