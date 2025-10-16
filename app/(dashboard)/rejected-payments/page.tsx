import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { getRejectedPayments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RejectedPaymentsPage() {
  const { records, totalAmount, totalCount, lastEvent } = await getRejectedPayments();

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
        { label: "Pagamentos recusados", value: totalCount.toString() },
        {
          label: "Valor perdido",
          value: formatCurrency(totalAmount, currency) ?? "—",
          helper: "Somatório dos pagamentos recusados recentemente",
        },
        {
          label: "Última recusa",
          value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
          helper: "Atualize para verificar novos webhooks",
        },
      ]}
      heading="Recusas mais recentes"
      description="Listagem limitada aos últimos 40 eventos de pagamento recusado enviados pela Kiwify."
      emptyState="Nenhum pagamento recusado registrado até agora. Aguarde o primeiro webhook de recusa da Kiwify."
      events={events}
    />
  );
}
