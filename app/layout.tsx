import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Kiwify Hub - Carrinhos abandonados',
  description: 'Centralize os eventos de carrinho abandonado da Kiwify com disparo manual de e-mails.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
          <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-lg font-semibold text-white transition hover:text-brand">
              Kiwify Hub
            </Link>
            <nav>
              <ul className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-300">
                <li>
                  <Link href="/" className="transition hover:text-white">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/sales" className="transition hover:text-white">
                    Vendas aprovadas
                  </Link>
                </li>
                <li>
                  <Link href="/integracoes" className="transition hover:text-white">
                    Integrações
                  </Link>
                </li>
                <li>
                  <Link href="/clientes" className="transition hover:text-white">
                    Clientes
                  </Link>
                </li>
                <li>
                  <Link href="/ads" className="transition hover:text-white">
                    Gestão de Ads
                  </Link>
                </li>
                <li>
                  <Link href="/test" className="transition hover:text-white">
                    Envio de teste
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="transition hover:text-white">
                    Login
                  </Link>
                </li>
              </ul>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
