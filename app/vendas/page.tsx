import Card from '../../components/Card';
import SalesTable from '../../components/SalesTable';
import { fetchDashboardSales } from '../../lib/sales';
import { getBadgeVariant } from '../../lib/status';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const sales = await fetchDashboardSales();
  const approvedSales = sales.filter((sale) => getBadgeVariant(sale.status ?? 'approved') === 'approved');

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Vendas aprovadas</h1>
        <p className="max-w-3xl text-sm text-slate-400">Acompanhe apenas as vendas confirmadas para avaliar resultados.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Vendas aprovadas"
          value={approvedSales.length}
          description="Total de pagamentos confirmados."
        />
      </section>

      <SalesTable sales={approvedSales} />
    </main>
  );
}
