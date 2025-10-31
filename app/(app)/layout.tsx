import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, Grid3x3, HelpCircle, Search, UserCircle2 } from 'lucide-react';
import { MainNav } from '@/components/navigation/MainNav';

export default function AppLayout({ children }: { readonly children: ReactNode }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f7] text-slate-900">
      <header className="relative bg-[#0231b1] pb-12 text-white shadow-[0_18px_50px_rgba(2,49,177,0.25)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-4 py-6 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold uppercase tracking-tight">
              f
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold tracking-tight">frutify</span>
              <span className="text-xs text-white/70">Painel RB Hub</span>
            </div>
          </Link>

          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white/90 shadow-inner">
            <Grid3x3 className="h-4 w-4" />
            <span>Team RB LTDA</span>
            <ChevronDown className="h-4 w-4" />
          </div>

          <div className="relative flex-1 min-w-[220px] sm:min-w-[260px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              placeholder="Busque na plataforma"
              className="h-12 w-full rounded-full border border-white/20 bg-white/15 pl-12 pr-4 text-sm font-medium text-white placeholder:text-white/50 focus:border-white focus:outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-3 text-white">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"
            >
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 text-left shadow-inner">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <UserCircle2 className="h-6 w-6" />
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold">Eduardo</p>
                <p className="text-xs text-white/70">eduardo@rbhub.com</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 sm:block" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-12">
        <div className="-mt-16 mx-auto w-full max-w-6xl space-y-8 px-4 sm:px-6">
          <MainNav />
          <div className="space-y-8 pt-2">{children}</div>
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200/70 bg-white/80 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 text-xs text-slate-500 sm:flex-row">
          <span>© {currentYear} RB Hub</span>
          <span>Sincronização oficial Kiwify + Supabase</span>
        </div>
      </footer>
    </div>
  );
}
