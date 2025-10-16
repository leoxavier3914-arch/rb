import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { getRefundedSales } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RefundedSalesPage() {
  const { records, totalAmount, totalCount, lastEvent } = await getRefundedSales();

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
        { label: "Total de reembolsos", value: totalCount.toString() },
        {
          label: "Valor devolvido",
          value: formatCurrency(totalAmount, currency) ?? "—",
          helper: "Somatório dos últimos reembolsos registrados",
        },
        {
          label: "Último reembolso",
          value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
          helper: "Atualize a página para sincronizar novos eventos",
        },
      ]}
      heading="Reembolsos mais recentes"
      description="Listagem limitada aos últimos 40 eventos enviados pela Kiwify."
      emptyState="Nenhum reembolso recebido até o momento. Aguarde o primeiro webhook de reembolso da Kiwify."
      events={events}
    />
  );
}
