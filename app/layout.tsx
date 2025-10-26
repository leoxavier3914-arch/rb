import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RB Sigma Hub',
  description:
    'Painel SaaS para centralizar sincronização e visualização dos dados da Kiwify com cache local via Supabase.'
};

export default function RootLayout({
  children
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
