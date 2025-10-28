'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type LucideIcon,
  Activity,
  Boxes,
  CalendarCheck,
  GraduationCap,
  Handshake,
  Import,
  LayoutDashboard,
  Repeat,
  RotateCcw,
  Settings,
  ShoppingCart,
  Ticket,
  Users,
  Wallet,
  Webhook,
  UserCircle2,
  X
} from 'lucide-react';
import { cn } from '@/lib/ui/classnames';

interface SidebarProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface SidebarItem {
  readonly label: string;
  readonly href: Route;
  readonly icon: LucideIcon;
}

const items: SidebarItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Conta', href: '/account', icon: UserCircle2 },
  { label: 'Vendas', href: '/sales', icon: ShoppingCart },
  { label: 'Produtos', href: '/products', icon: Boxes },
  { label: 'Afiliados', href: '/affiliates', icon: Handshake },
  { label: 'Webhooks', href: '/webhooks', icon: Webhook },
  { label: 'Eventos', href: '/events', icon: CalendarCheck },
  { label: 'Financeiro', href: '/payouts', icon: Wallet },
  { label: 'Clientes', href: '/customers', icon: Users },
  { label: 'Assinaturas', href: '/subscriptions', icon: Repeat },
  { label: 'Cursos', href: '/courses', icon: GraduationCap },
  { label: 'Cupons', href: '/coupons', icon: Ticket },
  { label: 'Reembolsos', href: '/refunds', icon: RotateCcw },
  { label: 'Export/Import', href: '/export-import', icon: Import },
  { label: 'Config/Sync', href: '/config-sync', icon: Settings },
  { label: 'Status', href: '/status', icon: Activity }
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const content = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center border-b border-slate-200 px-6 text-lg font-semibold">RB Sigma Hub</div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {items.map(item => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
              onClick={onClose}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block">{content}</aside>
      <div
        className={cn(
          'fixed inset-0 z-40 flex lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <div className={cn('absolute inset-0 bg-slate-900/50 transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
        <div
          className={cn(
            'relative ml-auto flex h-full w-64 max-w-[80%] translate-x-full flex-col bg-white shadow-xl transition-transform',
            open ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <button
            type="button"
            className="absolute right-3 top-3 rounded-full p-1 text-slate-500 hover:text-slate-900"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          {content}
        </div>
      </div>
    </>
  );
}
