import Card from '../../components/Card';
import FeedbackDashboard from '../../components/FeedbackDashboard';
import { fetchApprovedSales } from '../../lib/sales';
import { fetchAbandonedCarts } from '../../lib/abandonedCarts';
import { buildFeedbackEntries } from '../../lib/feedback';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const computeMetrics = (entriesLength: number, statuses: Record<string, number>) => {
  const converted = statuses.converted ?? 0;
  const pending = (statuses.pending ?? 0) + (statuses.sent ?? 0);
  const refunded = statuses.refunded ?? 0;

  return [
    {
      title: 'Clientes únicos',
      value: entriesLength,
      description: 'Total de clientes com compras ou carrinhos recentes.',
    },
    {
      title: 'Feedback concluído',
      value: converted,
      description: 'Clientes com compra aprovada ou convertida.',
    },
    {
      title: 'Aguardando ação',
      value: pending,
      description: 'Clientes pendentes ou com e-mail enviado aguardando retorno.',
    },
    {
      title: 'Reembolsados',
      value: refunded,
      description: 'Compras marcadas como reembolsadas para acompanhamento.',
    },
  ];
};

export default async function FeedbackPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const [sales, carts] = await Promise.all([fetchApprovedSales(), fetchAbandonedCarts()]);
  const entries = buildFeedbackEntries(sales, carts);

  const statusCount = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.status] = (acc[entry.status] ?? 0) + 1;
    return acc;
  }, {});

  const cards = computeMetrics(entries.length, statusCount);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Feedback automático</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Concentre em um só lugar os clientes com vendas aprovadas ou carrinhos convertidos e configure o envio
          manual de feedback por e-mail e WhatsApp Business.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} title={card.title} value={card.value} description={card.description} />
        ))}
      </section>

      <FeedbackDashboard entries={entries} />
    </main>
  );
}
