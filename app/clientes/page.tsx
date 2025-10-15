import Card from '../../components/Card';
import ClientsContent from './ClientsContent';
import type { ClientPurchase, ClientSummary } from './ClientsContent';
import { fetchApprovedSales } from '../../lib/sales';
import { formatTrafficSourceLabel, getTrafficCategory, getTrafficCategoryLabel } from '../../lib/traffic';
import type { Sale } from '../../lib/types';
import { parsePgTimestamp } from '../../lib/dates';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const formatPaidAt = (sale: Sale): { label: string; timestamp: number } => {
  const paidDate = parsePgTimestamp(sale.paid_at);
  if (!paidDate) {
    return { label: 'Data não informada', timestamp: 0 };
  }

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return { label: formatter.format(paidDate), timestamp: paidDate.getTime() };
};

const DIRECT_PURCHASE_SOURCE = 'kiwify.webhook_purchase';

const getConversionLabel = (sale: Sale): string => {
  const source = sale.source?.toLowerCase() ?? '';
  if (source && source !== DIRECT_PURCHASE_SOURCE) {
    return 'Carrinho recuperado';
  }

  return 'Aprovado direto';
};

type TopProduct = {
  productName: string;
  count: number;
};

const groupSalesByClient = (sales: Sale[]): ClientSummary[] => {
  const clientsMap = new Map<string, ClientSummary>();

  for (const sale of sales) {
    const email = sale.customer_email.trim();
    if (!email) {
      continue;
    }

    const { label: paidAtLabel, timestamp } = formatPaidAt(sale);
    const purchase: ClientPurchase = {
      productName: sale.product_name ?? 'Produto não informado',
      paidAtLabel,
      paidAtTimestamp: timestamp,
      conversionLabel: getConversionLabel(sale),
      originLabel: formatTrafficSourceLabel(sale.traffic_source),
      groupLabel: getTrafficCategoryLabel(getTrafficCategory(sale.traffic_source)),
    };

    const existing = clientsMap.get(email);

    if (existing) {
      existing.purchases.push(purchase);
      existing.lastPurchaseTimestamp = Math.max(existing.lastPurchaseTimestamp, timestamp);
      if (!existing.name && sale.customer_name) {
        existing.name = sale.customer_name;
      }
    } else {
      clientsMap.set(email, {
        email,
        name: sale.customer_name,
        purchases: [purchase],
        lastPurchaseTimestamp: timestamp,
      });
    }
  }

  const clients = Array.from(clientsMap.values());

  for (const client of clients) {
    client.purchases.sort((a, b) => b.paidAtTimestamp - a.paidAtTimestamp);
  }

  clients.sort((a, b) => b.lastPurchaseTimestamp - a.lastPurchaseTimestamp);

  return clients;
};

const getTopProducts = (sales: Sale[], limit = 3): TopProduct[] => {
  const counts = new Map<string, number>();

  for (const sale of sales) {
    const productName = sale.product_name ?? 'Produto não informado';
    counts.set(productName, (counts.get(productName) ?? 0) + 1);
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

  const sales = await fetchApprovedSales();
  const approvedSales = sales.filter((sale) => sale.status === 'approved');
  const clients = groupSalesByClient(approvedSales);
  const totalPurchases = clients.reduce((acc, client) => acc + client.purchases.length, 0);
  const topProducts = getTopProducts(approvedSales);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Clientes</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Visualize as clientes com pagamento aprovado, organize suas compras e entenda os canais de origem
          responsáveis por cada conversão.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Clientes com compra" value={clients.length} description="Somente pagamentos aprovados" />
        <Card title="Pedidos registrados" value={totalPurchases} description="Total de compras por estas clientes" />
        <Card
          title="Média de pedidos"
          value={clients.length ? (totalPurchases / clients.length).toFixed(1) : '0.0'}
          description="Pedidos por cliente com pagamento aprovado"
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

      {clients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          Nenhum pagamento aprovado encontrado até o momento.
        </p>
      ) : (
        <ClientsContent clients={clients} />
      )}
    </main>
  );
}
