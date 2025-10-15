import Card from '../../components/Card';
import ApprovedSalesTable from '../../components/ApprovedSalesTable';
import { fetchApprovedSales } from '../../lib/sales';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { buildSalesSummary } from './summary';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const sales = await fetchApprovedSales();
  const summary = buildSalesSummary(sales);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Pagamentos aprovados</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Analise as vendas aprovadas, descubra quais recuperaram carrinhos abandonados e acesse os links de checkout
          correspondentes.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Vendas registradas" value={summary.total} description="Total de registros importados." />
        <Card
          title="Pagamentos aprovados"
          value={summary.approved}
          description={`Status confirmado com sucesso (${summary.approvalRate.toFixed(1)}% do total).`}
        />
        <Card title="Vendas reembolsadas" value={summary.refunded} description="Registros marcados como reembolso." />
        <Card title="Recuperadas após abandono" value={summary.recovered} description="Pagamentos vindos de retomada." />
      </section>

      <ApprovedSalesTable sales={sales} />
    </main>
  );
}
