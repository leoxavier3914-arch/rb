import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import IntegrationNav from '../../components/IntegrationNav';

export default function IntegracoesLayout({ children }: { children: ReactNode }) {
  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');

  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Centralize as conexões com os canais de comunicação e personalize fluxos, automações e templates
          utilizados pela plataforma.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[260px,1fr]">
        <IntegrationNav />
        <div className="space-y-10">{children}</div>
      </div>
    </main>
  );
}
