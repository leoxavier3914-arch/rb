import Card from '../components/Card';
import DashboardEventsTable from '../components/DashboardEventsTable';
import { groupLatestDashboardEvents } from '../lib/sales';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import type { DashboardSaleStatus, GroupedDashboardEvent } from '../lib/types';

export const dynamic = 'force-dynamic';

const STATUS_CARD_CONFIG: Array<{
  status: DashboardSaleStatus;
  title: string;
  description: string;
}> = [
  {
    status: 'approved',
    title: 'Pagamentos aprovados',
    description: 'Cobranças concluídas com sucesso',
  },
  {
    status: 'abandoned',
    title: 'Abandonados',
    description: 'Carrinhos sem pagamento após 1 hora',
  },
  {
    status: 'refunded',
    title: 'Reembolsados',
    description: 'Pagamentos devolvidos aos clientes',
  },
  {
    status: 'refused',
    title: 'Recusados',
    description: 'Tentativas com pagamento negado',
  },
  {
    status: 'new',
    title: 'Novos',
    description: 'Eventos recém recebidos',
  },
];

const computeStatusCounts = (events: GroupedDashboardEvent[]) => {
  return events.reduce<Record<DashboardSaleStatus, number>>(
    (acc, event) => {
      acc[event.status] += 1;
      return acc;
    },
    {
      approved: 0,
      abandoned: 0,
      refunded: 0,
      refused: 0,
      new: 0,
    },
  );
};

export default async function Home() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const events = await groupLatestDashboardEvents();
  const statusCounts = computeStatusCounts(events);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Dashboard de eventos</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Acompanhe os eventos da webhook da Kiwify agrupados por cliente e produto para identificar conversões
          recentes, abandonos e reembolsos.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
        {STATUS_CARD_CONFIG.map((card) => (
          <Card
            key={card.status}
            title={card.title}
            value={statusCounts[card.status] ?? 0}
            description={card.description}
          />
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Eventos</h2>
          <p className="text-sm text-slate-400">
            Exibindo apenas o evento mais recente por cliente e produto, ordenados pelo último movimento recebido.
          </p>
        </div>
        <DashboardEventsTable events={events} />
      </section>
    </main>
  );
}
