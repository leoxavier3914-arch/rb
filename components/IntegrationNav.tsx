'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/integracoes/whatsapp', label: 'WhatsApp', description: 'Fluxos e mensagens rápidas' },
  { href: '/integracoes/instagram', label: 'Instagram', description: 'Respostas e direct automatizado' },
  { href: '/integracoes/tiktok', label: 'TikTok', description: 'Mensagens para leads e comentários' },
];

export default function IntegrationNav() {
  const pathname = usePathname();

  return (
    <nav className="h-full rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <ul className="space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={clsx(
                  'block rounded-xl border border-transparent p-4 transition',
                  'hover:border-slate-700 hover:bg-slate-900/60 hover:text-white',
                  isActive ? 'border-brand bg-slate-900/80 text-white shadow-lg shadow-brand/20' : 'text-slate-400',
                )}
              >
                <p className="text-sm font-semibold">{link.label}</p>
                <p className="text-xs text-slate-400">{link.description}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
