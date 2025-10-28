"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import { NAV_ITEMS, resolveNavTitle } from "@/config/navigation";

export function AppShell({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeTitle = useMemo(() => resolveNavTitle(pathname ?? "/"), [pathname]);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-lg transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-semibold tracking-tight text-slate-900">Hub de Vendas</span>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {NAV_ITEMS.map(item => {
            const isActive = pathname?.startsWith(item.href) ?? false;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", 
                  isActive
                    ? "bg-slate-900 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
                onClick={() => setOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-transparent p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 md:hidden"
              onClick={() => setOpen(current => !current)}
              aria-label="Alternar menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hub Kiwify</p>
              <h1 className="text-lg font-semibold text-slate-900 md:text-2xl">{activeTitle}</h1>
            </div>
          </div>
          <div className="hidden md:flex md:flex-col md:items-end">
            <span className="text-sm font-medium text-slate-700">Sincronização manual</span>
            <span className="text-xs text-slate-500">Dados oficiais da API Kiwify</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
