import type { ReactNode } from 'react';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/MainNav';

export default function AppLayout({ children }: { readonly children: ReactNode }) {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-slate-900">
            RB Hub
          </Link>
          <MainNav />
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">{children}</div>
      </main>
      <footer className="border-t border-slate-200 bg-white/80 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 text-xs text-slate-500">
          <span>© {currentYear} RB Hub</span>
          <span>Sincronização oficial Kiwify + Supabase</span>
        </div>
      </footer>
    </div>
  );
}
