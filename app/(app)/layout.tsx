import type { ReactNode } from 'react';
import { AppProviders } from '@/components/providers/AppProviders';
import { AppShell } from '@/components/shell/AppShell';

export default function AppLayout({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
