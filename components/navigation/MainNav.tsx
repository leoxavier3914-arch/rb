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
  FileArchive,
  FileBarChart,
  FileBox,
  FileCog,
  FileOutput,
  FileStack,
  FileType,
  LayoutDashboard,
  Package,
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
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/webhooks', label: 'Webhooks', icon: Receipt },
  { href: '/pendentes', label: 'Pendentes', icon: ShoppingBag },
  { href: '/reembolsados', label: 'Reembolsados', icon: CreditCard },
  { href: '/recusados', label: 'Recusados', icon: Users2 },
  { href: '/configs', label: 'Configs', icon: Settings },
  { href: '/teste-1', label: 'Teste 1', icon: FileArchive },
  { href: '/teste-2', label: 'Teste 2', icon: FileBarChart },
  { href: '/teste-3', label: 'Teste 3', icon: FileBox },
  { href: '/teste-4', label: 'Teste 4', icon: FileCog },
  { href: '/teste-5', label: 'Teste 5', icon: FileStack },
  { href: '/teste-6', label: 'Teste 6', icon: FileType },
  { href: '/teste-7', label: 'Teste 7', icon: FileOutput }
];

const SECTION_COUNT = 3;
const SECTION_SIZE = 8;

const navSections = Array.from({ length: SECTION_COUNT }, (_, index) =>
  items.slice(index * SECTION_SIZE, (index + 1) * SECTION_SIZE)
);

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

  const scrollByPage = (direction: -1 | 1) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const wrapper = container.firstElementChild as HTMLElement | null;
    const computedStyle = window.getComputedStyle(container);
    const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
    const contentWidth = container.clientWidth - paddingLeft - paddingRight;
    const firstPage = wrapper?.firstElementChild as HTMLElement | null;
    const firstPageStyle = firstPage ? window.getComputedStyle(firstPage) : null;
    const parseSpacing = (value: string | null | undefined) => Number.parseFloat(value ?? '') || 0;
    const firstPageHorizontalMargins = firstPageStyle
      ? parseSpacing(firstPageStyle.marginLeft) + parseSpacing(firstPageStyle.marginRight)
      : 0;

    let pageStride: number | null = null;

    if (firstPage && firstPage.nextElementSibling instanceof HTMLElement) {
      const secondPage = firstPage.nextElementSibling;
      const secondPageStyle = window.getComputedStyle(secondPage);
      const secondPageMarginLeft = parseSpacing(secondPageStyle.marginLeft);
      const offsetDifference = secondPage.offsetLeft - firstPage.offsetLeft;
      if (offsetDifference > 0) {
        pageStride = offsetDifference + firstPageHorizontalMargins + secondPageMarginLeft;
      } else {
        const firstRect = firstPage.getBoundingClientRect();
        const secondRect = secondPage.getBoundingClientRect();
        const rectDifference = secondRect.left - firstRect.left;
        if (rectDifference > 0) {
          pageStride = rectDifference + firstPageHorizontalMargins + secondPageMarginLeft;
        }
      }
    }

    if (pageStride === null) {
      const wrapperStyle = wrapper ? window.getComputedStyle(wrapper) : null;
      const gapValue =
        wrapperStyle?.gap || wrapperStyle?.columnGap || wrapperStyle?.rowGap || '0';
      const gap = Number.parseFloat(gapValue) || 0;
      const pageWidth = firstPage ? firstPage.getBoundingClientRect().width : contentWidth;
      // Include horizontal margins so the stride covers visual gaps between pages.
      pageStride = pageWidth + gap + firstPageHorizontalMargins;
    }

    if (pageStride !== null) {
      pageStride = Math.max(pageStride, contentWidth);
    }

    if (pageStride === null || pageStride <= 0) {
      return;
    }
    const currentPage = Math.round(container.scrollLeft / pageStride);
    const targetPage = Math.min(Math.max(currentPage + direction, 0), navSections.length - 1);
    const targetScroll = targetPage * pageStride;

    container.scrollTo({ left: targetScroll, behavior: 'smooth' });
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
          onClick={() => scrollByPage(-1)}
          disabled={!canScrollLeft}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div
          ref={scrollContainerRef}
          className={cn(
            'flex-1 overflow-x-auto pb-14 sm:pb-16 main-nav-scroll -mx-8 px-8 sm:-mx-12 sm:px-12',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={endDragging}
          onPointerUp={endDragging}
          onPointerCancel={endDragging}
        >
          <div className="flex min-w-full items-start">
            {navSections.map((pageItems, pageIndex) => (
              <div
                key={`page-${pageIndex}`}
                className={cn(
                  'grid w-full min-w-full flex-none basis-full grid-cols-2 gap-4 sm:grid-cols-4',
                  pageIndex < navSections.length - 1 && 'mr-8 sm:mr-10'
                )}
              >
                {pageItems.map(item => {
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
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-label="Deslocar para a direita"
          onClick={() => scrollByPage(1)}
          disabled={!canScrollRight}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
