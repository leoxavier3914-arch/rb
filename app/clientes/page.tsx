import Card from '../../components/Card';
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

const getConversionLabel = (sale: Sale): string => {
  const status = sale.status?.toLowerCase() ?? '';
  if (status.includes('convert')) {
    return 'Carrinho recuperado';
  }

  return 'Compra direta';
};

type ClientPurchase = {
  productName: string;
  paidAtLabel: string;
  paidAtTimestamp: number;
  conversionLabel: string;
  originLabel: string;
  groupLabel: string;
};

type ClientSummary = {
  email: string;
  name: string | null;
  purchases: ClientPurchase[];
  lastPurchaseTimestamp: number;
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

export default async function ClientsPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const sales = await fetchApprovedSales();
  const clients = groupSalesByClient(sales);
  const totalPurchases = clients.reduce((acc, client) => acc + client.purchases.length, 0);

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

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Lista de clientes</h2>
          <p className="text-sm text-slate-400">Toque para expandir os detalhes de cada cliente.</p>
        </div>

        {clients.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
            Nenhum pagamento aprovado encontrado até o momento.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {clients.map((client) => (
              <details
                key={client.email}
                className="group rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-700"
              >
                <summary className="cursor-pointer list-none outline-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {client.name ?? 'Cliente sem nome'}
                      </p>
                      <p className="text-sm text-slate-400">{client.email}</p>
                    </div>
                    <span className="text-sm text-slate-400">
                      {client.purchases.length === 1
                        ? '1 compra registrada'
                        : `${client.purchases.length} compras registradas`}
                    </span>
                  </div>
                </summary>

                <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
                  {client.purchases.map((purchase, index) => (
                    <article
                      key={`${client.email}-${purchase.paidAtTimestamp}-${index}`}
                      className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
                    >
                      <h3 className="text-base font-semibold text-white">{purchase.productName}</h3>
                      <dl className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                        <div>
                          <dt className="font-medium text-slate-400">Pagamento</dt>
                          <dd>{purchase.paidAtLabel}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-400">Tipo de conversão</dt>
                          <dd>{purchase.conversionLabel}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-400">Origem informada</dt>
                          <dd>{purchase.originLabel}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-400">Grupo de tráfego</dt>
                          <dd>{purchase.groupLabel}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
