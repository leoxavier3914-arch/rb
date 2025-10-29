'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/ui/classnames';

type NavItem = {
  href: Route;
  label: string;
};

const items: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/financeiro', label: 'Financeiro' },
  { href: '/vendas', label: 'Vendas' },
  { href: '/pendentes', label: 'Pendentes' },
  { href: '/configs', label: 'Configs' }
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-1.5 py-1 text-sm shadow-sm">
      {items.map(item => {
        const active = pathname ? pathname.startsWith(item.href) : item.href === '/dashboard';
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-3 py-1.5 font-medium transition-colors',
              active ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
