import Card from '../../components/Card';
import SalesTable from '../../components/SalesTable';
import { fetchDashboardSales } from '../../lib/sales';
import type { DashboardSale, DashboardSaleStatus } from '../../lib/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const STATUS_CARD_CONFIG: Array<{
  key: DashboardSaleStatus;
  title: string;
  description: string;
}> = [
  {
    key: 'approved',
    title: 'Vendas aprovadas',
    description: 'Pagamentos confirmados automaticamente em até 1 hora.',
  },
  {
    key: 'abandoned',
    title: 'Carrinhos abandonados',
    description: 'Pix e intenções sem pagamento após 1 hora.',
  },
  {
    key: 'refused',
    title: 'Compras recusadas',
    description: 'Tentativas com pagamento negado ou cancelado.',
  },
  {
    key: 'refunded',
    title: 'Vendas reembolsadas',
    description: 'Pedidos marcados como reembolsados ou estornados.',
  },
  {
    key: 'new',
    title: 'Carrinhos novos',
    description: 'Intenções de pagamento geradas há menos de 1 hora.',
  },
];

const buildStatusCounters = (sales: DashboardSale[]) => {
  const initial: Record<DashboardSaleStatus, number> = {
    new: 0,
    approved: 0,
    abandoned: 0,
    refunded: 0,
    refused: 0,
    pending: 0,
  };

  for (const sale of sales) {
    initial[sale.status] = (initial[sale.status] ?? 0) + 1;
  }

  return initial;
};

export default async function SalesPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const sales = await fetchDashboardSales();
  const statusCounters = buildStatusCounters(sales);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Status de vendas e carrinhos</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Acompanhe a evolução dos carrinhos desde a criação, identifique pagamentos confirmados e monitore abandonos ou
          recusas em um só lugar.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Registros totais" value={sales.length} description="Todos os status acompanhados." />
        {STATUS_CARD_CONFIG.map(({ key, title, description }) => (
          <Card key={key} title={title} value={statusCounters[key]} description={description} />
        ))}
      </section>

      <SalesTable sales={sales} />
    </main>
  );
}
