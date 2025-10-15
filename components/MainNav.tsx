'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

type NavLink = {
  href: string;
  label: string;
};

const NAV_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/carrinhos-abandonados', label: 'Carrinhos abandonados' },
  { href: '/vendas', label: 'Vendas' },
  { href: '/reembolsados', label: 'Reembolsados' },
  { href: '/recusados', label: 'Recusados' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/leads', label: 'Leads' },
  { href: '/integracoes', label: 'Integrações' },
  { href: '/configuracoes', label: 'Configurações' },
];

const normalizePath = (value: string | null) => {
  if (!value) {
    return '/';
  }

  if (value === '/') {
    return '/';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const isActive = (pathname: string, href: string) => {
  const current = normalizePath(pathname);
  const target = normalizePath(href);

  if (target === '/dashboard') {
    return current === '/dashboard' || current === '/';
  }

  if (target === '/') {
    return current === '/';
  }

  return current === target || current.startsWith(`${target}/`);
};

export default function MainNav() {
  const pathname = usePathname();

  return (
    <nav>
      <ul className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {NAV_LINKS.map((item) => {
          const active = isActive(pathname ?? '/', item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  'relative inline-flex items-center rounded-md px-3 py-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
                  active
                    ? 'bg-slate-800 text-white shadow shadow-brand/20'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white',
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-brand" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
