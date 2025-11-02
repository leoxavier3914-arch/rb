import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RB Hub',
  description: 'Hub minimalista para sincronizar e visualizar vendas da Kiwify via Supabase.'
};

export default function RootLayout({
  children
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
