'use client';

import { CompactProvider } from './CompactProvider';
import { PeriodProvider } from './PeriodProvider';
import { QueryProvider } from './QueryProvider';

export function AppProviders({ children }: { readonly children: React.ReactNode }): JSX.Element {
  return (
    <QueryProvider>
      <PeriodProvider>
        <CompactProvider>{children}</CompactProvider>
      </PeriodProvider>
    </QueryProvider>
  );
}
