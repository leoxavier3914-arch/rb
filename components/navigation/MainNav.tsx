'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type WheelEvent as ReactWheelEvent
} from 'react';
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

type NavSection = (NavItem | null)[];

const NAV_ITEMS: NavItem[] = [
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
const SECTION_GAP_IN_PX = 32;

const NAV_SECTIONS = createNavSections(NAV_ITEMS, SECTION_SIZE);

function createNavSections(items: NavItem[], size: number): NavSection[] {
  const sections: NavSection[] = [];

  for (let index = 0; index < items.length; index += size) {
    const slice: NavSection = items.slice(index, index + size);

    if (!slice.length) {
      continue;
    }

    while (slice.length < size) {
      slice.push(null);
    }

    sections.push(slice);
  }

  return sections;
}

export function MainNav() {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState(0);
  const hasMultipleSections = NAV_SECTIONS.length > 1;
  const wheelLockRef = useRef(false);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goToSection = useCallback(
    (index: number, { lockWheel = false }: { lockWheel?: boolean } = {}) => {
      if (!hasMultipleSections) {
        return;
      }

      setActiveSection(prev => {
        const clampedIndex = Math.min(Math.max(index, 0), NAV_SECTIONS.length - 1);
        if (prev === clampedIndex) {
          return prev;
        }

        if (lockWheel) {
          wheelLockRef.current = true;
          if (wheelTimeoutRef.current) {
            clearTimeout(wheelTimeoutRef.current);
          }
          wheelTimeoutRef.current = setTimeout(() => {
            wheelLockRef.current = false;
            wheelTimeoutRef.current = null;
          }, 500);
        }

        return clampedIndex;
      });
    },
    [hasMultipleSections]
  );

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const sectionIndex = NAV_SECTIONS.findIndex(section =>
      section.some(item => item && pathname.startsWith(item.href))
    );

    if (sectionIndex >= 0 && sectionIndex !== activeSection) {
      setActiveSection(sectionIndex);
    }
  }, [pathname, activeSection]);

  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  const sliderStyles = useMemo<CSSProperties>(() => {
    const styles: CSSProperties = {
      gap: `${SECTION_GAP_IN_PX}px`
    };

    if (hasMultipleSections) {
      styles.transform = `translate3d(calc(-${activeSection} * (100% + ${SECTION_GAP_IN_PX}px)), 0, 0)`;
    }

    return styles;
  }, [activeSection, hasMultipleSections]);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!hasMultipleSections || wheelLockRef.current) {
        return;
      }

      const direction = Math.sign(Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY);

      if (direction === 0) {
        return;
      }

      const nextIndex = activeSection + (direction > 0 ? 1 : -1);

      if (nextIndex < 0 || nextIndex >= NAV_SECTIONS.length) {
        return;
      }

      event.preventDefault();
      goToSection(nextIndex, { lockWheel: true });
    },
    [activeSection, goToSection, hasMultipleSections]
  );

  return (
    <nav className="relative z-10">
      <div className="-mx-4 overflow-hidden px-4 pb-16 sm:-mx-6 sm:px-6 sm:pb-20 lg:-mx-8 lg:px-8">
        <div
          className={cn(
            'flex w-full justify-center transition-transform duration-500 ease-out',
            hasMultipleSections ? 'will-change-transform' : 'transform-none'
          )}
          style={sliderStyles}
          onWheel={handleWheel}
          role={hasMultipleSections ? 'list' : undefined}
        >
          {NAV_SECTIONS.map((pageItems, pageIndex) => (
            <div
              key={`page-${pageIndex}`}
              className="flex w-full shrink-0 basis-full justify-center"
              aria-hidden={hasMultipleSections ? activeSection !== pageIndex : undefined}
            >
              <div className="grid w-full max-w-4xl grid-cols-4 grid-rows-2 gap-4">
                {pageItems.map((item, itemIndex) => {
                  if (!item) {
                    return (
                      <span
                        key={`placeholder-${itemIndex}`}
                        aria-hidden
                        className="block rounded-3xl opacity-0"
                      />
                    );
                  }

                  const active = pathname
                    ? pathname.startsWith(item.href)
                    : item.href === '/dashboard';
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
          ))}
        </div>
      </div>
      {hasMultipleSections ? (
        <div className="mt-6 flex justify-center gap-2">
          {NAV_SECTIONS.map((_, index) => (
            <button
              key={`section-indicator-${index}`}
              type="button"
              aria-label={`Ir para a sessão ${index + 1}`}
              onClick={() => goToSection(index)}
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
