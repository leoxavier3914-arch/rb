'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
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

const SECTION_SIZE = 8;

const sectionCount = Math.ceil(items.length / SECTION_SIZE);
const navSections = Array.from({ length: sectionCount }, (_, index) =>
  items.slice(index * SECTION_SIZE, (index + 1) * SECTION_SIZE)
).filter(section => section.length > 0);

export function MainNav() {
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const closestSectionRef = useRef(0);
  const dragStateRef = useRef({
    isPointerDown: false,
    hasDragged: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: null as number | null
  });
  const [isDragging, setIsDragging] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const updateScrollControls = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return closestSectionRef.current;
    }
    const pages = pageRefs.current;
    if (!pages.length) {
      closestSectionRef.current = 0;
      setActiveSection(0);
      return closestSectionRef.current;
    }

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let closestIndex = closestSectionRef.current;
    let smallestDistance = Number.POSITIVE_INFINITY;

    pages.forEach((page, index) => {
      if (!page) return;
      const pageRect = page.getBoundingClientRect();
      const pageCenter = pageRect.left + pageRect.width / 2;
      const distance = Math.abs(containerCenter - pageCenter);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestIndex = index;
      }
    });

    closestSectionRef.current = closestIndex;
    setActiveSection(prev => (prev === closestIndex ? prev : closestIndex));
    return closestIndex;
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

  const scrollToSection = useCallback(
    (index: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const clampedIndex = Math.min(Math.max(index, 0), navSections.length - 1);
      const targetPage = pageRefs.current[clampedIndex];
      if (!targetPage) return;

      const containerRect = container.getBoundingClientRect();
      const pageRect = targetPage.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      const pageCenter = pageRect.left + pageRect.width / 2;
      const difference = pageCenter - containerCenter;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const targetScrollLeft = Math.max(
        0,
        Math.min(container.scrollLeft + difference, maxScrollLeft)
      );

      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
      closestSectionRef.current = clampedIndex;
      setActiveSection(prev => (prev === clampedIndex ? prev : clampedIndex));
      if (typeof window !== 'undefined') {
        const ensureUpdate = () => {
          updateScrollControls();
          const distance = Math.abs(container.scrollLeft - targetScrollLeft);
          if (distance > 1) {
            window.requestAnimationFrame(ensureUpdate);
          }
        };

        window.requestAnimationFrame(ensureUpdate);
      }
    },
    [updateScrollControls]
  );

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

    const { hasDragged } = dragState;
    const nearestSection = updateScrollControls();

    dragStateRef.current = {
      isPointerDown: false,
      hasDragged: false,
      startX: 0,
      scrollLeft: 0,
      pointerId: null
    };
    setIsDragging(false);
    if (hasDragged) {
      const targetSection =
        typeof nearestSection === 'number' ? nearestSection : closestSectionRef.current;
      scrollToSection(targetSection);
    }
  };

  return (
    <nav className="relative z-10">
      <div
        ref={scrollContainerRef}
        className={cn(
          'overflow-x-auto pb-16 sm:pb-20 main-nav-scroll -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 scroll-smooth snap-x snap-mandatory',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={endDragging}
        onPointerUp={endDragging}
        onPointerCancel={endDragging}
      >
        <div className="flex min-w-full items-start gap-x-8 sm:gap-x-12">
          {navSections.map((pageItems, pageIndex) => (
            <div
              key={`page-${pageIndex}`}
              className={cn(
                'grid w-full min-w-full flex-none basis-full grid-cols-2 gap-4 sm:grid-cols-4 snap-center'
              )}
              ref={element => {
                pageRefs.current[pageIndex] = element;
              }}
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
      {navSections.length > 1 ? (
        <div className="mt-6 flex justify-center gap-2">
          {navSections.map((_, index) => (
            <button
              key={`section-indicator-${index}`}
              type="button"
              aria-label={`Ir para a sessão ${index + 1}`}
              onClick={() => scrollToSection(index)}
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-colors',
                activeSection === index
                  ? 'bg-[#0231b1]'
                  : 'bg-slate-200 hover:bg-slate-300'
              )}
            />
          ))}
        </div>
      ) : null}
    </nav>
  );
}
