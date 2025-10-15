import StatusSalesTable from '../../components/StatusSalesTable';
import { fetchDashboardSales } from '../../lib/sales';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const TABLE_TITLE = 'Vendas reembolsadas';
const TABLE_DESCRIPTION = 'Acompanhe quais pedidos foram marcados como reembolso ou estorno e verifique os dados de contato.';

export default async function RefundedSalesPage() {
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
        <h1 className="text-3xl font-bold">Vendas reembolsadas</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Monitore os pedidos devolvidos para identificar motivos recorrentes e tomar ações rápidas com sua equipe de
          suporte.
        </p>
      </header>

      <StatusSalesTable sales={sales} status="refunded" title={TABLE_TITLE} description={TABLE_DESCRIPTION} />
    </main>
  );
}
