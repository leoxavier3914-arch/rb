import Card from '../../components/Card';
import LeadsTable from '../../components/LeadsTable';
import { computeLeadMetrics, fetchLeads } from '../../lib/leads';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');

  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const leads = await fetchLeads();
  const metrics = computeLeadMetrics(leads);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold text-white">Leads</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Acompanhe potenciais clientes que ainda não concluíram o pagamento e priorize abordagens com base na
          atividade recente em seus checkouts.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Leads únicos" value={metrics.totalLeads} description="Total de combinações cliente + produto em aberto." />
        <Card
          title="Novos nas últimas 24h"
          value={metrics.newLeadsLast24h}
          description="Leads criados nas últimas 24 horas."
        />
        <Card
          title="Ativos nas últimas 24h"
          value={metrics.activeLeadsLast24h}
          description="Leads com alguma atualização recente nas últimas 24 horas."
        />
      </section>

      <LeadsTable leads={leads} />
    </main>
  );
}
