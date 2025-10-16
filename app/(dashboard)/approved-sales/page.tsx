import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { getApprovedSales } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ApprovedSalesPage() {
  const { records, totalAmount, totalCount, lastEvent } = await getApprovedSales();

  const events = records.map((sale) => ({
    id: sale.id,
    title: sale.product_name ?? "Produto sem nome",
    subtitle: sale.customer_name ?? sale.customer_email ?? "Cliente desconhecido",
    amount: formatCurrency(sale.amount, sale.currency) ?? undefined,
    badge: sale.payment_method?.toUpperCase() ?? null,
    occurredAt: sale.occurred_at ?? sale.created_at,
    meta: sale.sale_id ?? undefined,
  }));

  const currency = records[0]?.currency;

  return (
    <EventsBoard
      stats={[
        { label: "Total de vendas", value: totalCount.toString() },
        {
          label: "Receita capturada",
          value: formatCurrency(totalAmount, currency) ?? "—",
          helper: "Somatório das últimas entradas",
        },
        {
          label: "Última confirmação",
          value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
          helper: "Atualize a página para forçar a sincronização",
        },
      ]}
      heading="Entradas mais recentes"
      description="Listagem limitada aos últimos 40 eventos confirmados pela Kiwify."
      emptyState="Ainda não recebemos vendas aprovadas. Aguardando o primeiro webhook da Kiwify."
      events={events}
    />
  );
}
