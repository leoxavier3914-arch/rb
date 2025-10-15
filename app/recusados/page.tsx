import StatusSalesTable from '../../components/StatusSalesTable';
import { fetchDashboardSales } from '../../lib/sales';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const TABLE_TITLE = 'Compras recusadas';
const TABLE_DESCRIPTION = 'Visualize rapidamente as tentativas de pagamento negadas para agir com o cliente e recuperar a venda.';

export default async function RefusedSalesPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const sales = await fetchDashboardSales();

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Compras recusadas</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Identifique rapidamente clientes que tiveram o pagamento negado e entre em contato para oferecer suporte ou
          alternativas de pagamento.
        </p>
      </header>

      <StatusSalesTable sales={sales} status="refused" title={TABLE_TITLE} description={TABLE_DESCRIPTION} />
    </main>
  );
}
