import type { Metadata, Viewport } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'RB Sigma Hub',
  description:
    'Painel SaaS para centralizar sincronização e visualização dos dados da Kiwify com cache local via Supabase.'
};

export const viewport: Viewport = {
  themeColor: '#020817'
};

export default function RootLayout({
  children
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={cn('bg-slate-900 text-slate-50')} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
