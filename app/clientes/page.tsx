import Card from '../../components/Card';
import ClientsContent from './ClientsContent';
import { fetchCustomersWithCheckouts } from '../../lib/sales';
import type { CustomerCheckoutAggregate, Sale } from '../../lib/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

type TopProduct = {
  productName: string;
  count: number;
};

const collectApprovedSales = (customers: CustomerCheckoutAggregate[]): Sale[] =>
  customers.flatMap((customer) => customer.approvedSales);

const getTopProducts = (customers: CustomerCheckoutAggregate[], limit = 3): TopProduct[] => {
  const counts = new Map<string, number>();

  for (const customer of customers) {
    for (const sale of customer.approvedSales) {
      const productName = sale.product_name ?? 'Produto não informado';
      counts.set(productName, (counts.get(productName) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productName, count]) => ({ productName, count }));
};

export default async function ClientsPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const customers = await fetchCustomersWithCheckouts();
  const customersWithApprovedSales = customers.filter((customer) => customer.approvedSales.length > 0);
  const approvedSales = collectApprovedSales(customersWithApprovedSales);
  const totalPurchases = approvedSales.length;
  const topProducts = getTopProducts(customers);
  const totalCustomersWithApproved = customersWithApprovedSales.length;
  const averageOrders = totalCustomersWithApproved
    ? (totalPurchases / totalCustomersWithApproved).toFixed(1)
    : '0.0';

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Clientes</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Consulte clientes com histórico de checkout, acompanhe pagamentos aprovados e veja como cada jornada
          evoluiu ao longo do tempo.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card
          title="Clientes com pedido aprovado"
          value={totalCustomersWithApproved}
          description="Total de clientes com pelo menos um pagamento confirmado"
        />
        <Card
          title="Pedidos aprovados"
          value={totalPurchases}
          description="Checkouts que resultaram em pagamento aprovado"
        />
        <Card
          title="Ticket médio de pedidos"
          value={averageOrders}
          description="Pedidos aprovados por cliente com compra registrada"
        />
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-brand">Produtos mais vendidos</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-300">
          {topProducts.length === 0 ? (
            <li className="text-slate-400">Nenhum produto vendido até o momento.</li>
          ) : (
            topProducts.map((product, index) => (
              <li key={product.productName} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <span className="font-medium text-white">{product.productName}</span>
                </span>
                <span className="text-xs uppercase tracking-widest text-slate-400">
                  {product.count} {product.count === 1 ? 'venda' : 'vendas'}
                </span>
              </li>
            ))
          )}
        </ol>
      </section>

      {customers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          Nenhum checkout encontrado até o momento.
        </p>
      ) : (
        <ClientsContent clients={customers} />
      )}
    </main>
  );
}
