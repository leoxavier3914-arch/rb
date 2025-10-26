'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCompact } from '@/components/providers/CompactProvider';
import { cn } from '@/lib/ui/classnames';
import { CommandMenu } from './CommandMenu';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: { readonly children: React.ReactNode }): JSX.Element {
  const pathname = usePathname();
  const { compact } = useCompact();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          onToggleSidebar={() => setSidebarOpen(current => !current)}
          onOpenCommandMenu={() => setCommandOpen(true)}
        />
        <main className={cn('flex-1 overflow-y-auto bg-slate-50', compact ? 'p-4' : 'p-6')}>
          <div className={cn('mx-auto w-full', compact ? 'max-w-6xl space-y-4' : 'max-w-7xl space-y-6')}>{children}</div>
        </main>
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
