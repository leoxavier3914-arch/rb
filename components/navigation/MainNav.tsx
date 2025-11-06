'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  CreditCard,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Users2,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/ui/classnames';

type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/financeiro', label: 'Financeiro', icon: BadgeDollarSign },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/webhooks', label: 'Webhooks', icon: Receipt },
  { href: '/pendentes', label: 'Pendentes', icon: ShoppingBag },
  { href: '/reembolsados', label: 'Reembolsados', icon: CreditCard },
  { href: '/recusados', label: 'Recusados', icon: Users2 },
  { href: '/configs', label: 'Configs', icon: Settings }
];

export function MainNav() {
  const pathname = usePathname();
  const pages = NAV_ITEMS.reduce<NavItem[][]>((acc, item, index) => {
    if (index % 8 === 0) {
      acc.push([]);
    }

    acc[acc.length - 1]?.push(item);

    return acc;
  }, []);

  return (
    <nav className="relative z-10">
      <div className="mx-auto max-w-4xl overflow-x-auto overflow-y-hidden px-4 pb-16 snap-x snap-mandatory sm:px-6 sm:pb-20 lg:px-8">
        <div className="flex min-w-full flex-nowrap">
          {pages.map((pageItems, pageIndex) => (
            <div
              key={pageIndex}
              className="grid min-w-full basis-full flex-shrink-0 grid-cols-2 gap-4 snap-start px-3 py-1 sm:grid-cols-4 sm:gap-6"
            >
              {pageItems.map(item => {
                const Icon = item.icon;
                const isActive = pathname
                  ? pathname.startsWith(item.href)
                  : item.href === '/dashboard';

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex h-full flex-col items-center justify-center gap-3 rounded-3xl border bg-white p-5 text-center text-sm font-semibold shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all',
                      isActive
                        ? 'border-[#0231b1] text-[#0231b1] shadow-[0_24px_50px_rgba(2,49,177,0.25)]'
                        : 'border-transparent text-slate-500 hover:-translate-y-0.5 hover:text-slate-700'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-colors',
                        isActive ? 'bg-[#0231b1]/10 text-[#0231b1]' : 'group-hover:bg-slate-200'
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
