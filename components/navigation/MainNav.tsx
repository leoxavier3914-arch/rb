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
  Users2
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
  { href: '/recusados', label: 'Recusados', icon: Users2 }
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="relative z-10">
      <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 pb-16 sm:-mx-6 sm:px-6 sm:pb-20 lg:-mx-8 lg:px-8">
        <div className="flex w-full max-w-4xl flex-nowrap justify-start gap-x-6 lg:mx-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = pathname
              ? pathname.startsWith(item.href)
              : item.href === '/dashboard';

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex h-full flex-none min-w-[12rem] flex-col items-center justify-center gap-3 rounded-3xl border bg-white p-5 text-center text-sm font-semibold shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all',
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
      </div>
    </nav>
  );
}
