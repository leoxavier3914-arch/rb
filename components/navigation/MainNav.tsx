'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Settings,
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

const items: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/financeiro', label: 'Financeiro', icon: BadgeDollarSign },
  { href: '/webhooks', label: 'Webhooks', icon: Receipt },
  { href: '/pendentes', label: 'Pendentes', icon: ShoppingBag },
  { href: '/reembolsados', label: 'Reembolsados', icon: CreditCard },
  { href: '/recusados', label: 'Recusados', icon: Users2 },
  { href: '/configs', label: 'Configs', icon: Settings }
];

export function MainNav() {
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    isPointerDown: false,
    hasDragged: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: null as number | null
  });
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollControls = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollControls();
    const handleScroll = () => updateScrollControls();
    container.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollControls());
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [updateScrollControls]);

  const scrollByAmount = (amount: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: amount, behavior: 'smooth' });
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => updateScrollControls());
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    dragStateRef.current = {
      isPointerDown: true,
      hasDragged: false,
      startX: event.clientX,
      scrollLeft: container.scrollLeft,
      pointerId: event.pointerId
    };

    container.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    const dragState = dragStateRef.current;
    if (!container || !dragState.isPointerDown) return;

    const deltaX = event.clientX - dragState.startX;
    if (!dragState.hasDragged && Math.abs(deltaX) < 4) {
      return;
    }

    dragState.hasDragged = true;
    setIsDragging(true);
    event.preventDefault();
    container.scrollLeft = dragState.scrollLeft - deltaX;
    updateScrollControls();
  };

  const endDragging = (_event: PointerEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    const dragState = dragStateRef.current;
    if (!container || !dragState.isPointerDown) return;

    if (dragState.pointerId !== null && container.hasPointerCapture(dragState.pointerId)) {
      container.releasePointerCapture(dragState.pointerId);
    }

    dragStateRef.current = {
      isPointerDown: false,
      hasDragged: false,
      startX: 0,
      scrollLeft: 0,
      pointerId: null
    };
    setIsDragging(false);
    updateScrollControls();
  };

  return (
    <nav className="relative z-10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Deslocar para a esquerda"
          onClick={() => scrollByAmount(-240)}
          disabled={!canScrollLeft}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex-1 overflow-x-auto pb-3',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={endDragging}
          onPointerUp={endDragging}
          onPointerCancel={endDragging}
        >
          <div className="grid min-w-full grid-cols-2 gap-4 sm:min-w-0 sm:grid-cols-4 xl:grid-cols-8">
            {items.map(item => {
              const active = pathname ? pathname.startsWith(item.href) : item.href === '/dashboard';
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex h-full flex-col items-center justify-center gap-3 rounded-3xl border bg-white p-5 text-center text-sm font-semibold shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-all',
                    active
                      ? 'border-[#0231b1] text-[#0231b1] shadow-[0_24px_50px_rgba(2,49,177,0.25)]'
                      : 'border-transparent text-slate-500 hover:-translate-y-0.5 hover:text-slate-700'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-colors',
                      active ? 'bg-[#0231b1]/10 text-[#0231b1]' : 'group-hover:bg-slate-200'
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
        <button
          type="button"
          aria-label="Deslocar para a direita"
          onClick={() => scrollByAmount(240)}
          disabled={!canScrollRight}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
