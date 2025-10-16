import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { getPendingPayments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PendingPaymentsPage() {
  const { records, totalAmount, totalCount, lastEvent } = await getPendingPayments();

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
        { label: "Pagamentos pendentes", value: totalCount.toString() },
        {
          label: "Valor aguardando confirmação",
          value: formatCurrency(totalAmount, currency) ?? "—",
          helper: "Somatório das tentativas pendentes mais recentes",
        },
        {
          label: "Última atualização",
          value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
          helper: "Atualize a página para sincronizar novos eventos",
        },
      ]}
      heading="Pendências em aberto"
      description="Listagem limitada aos últimos 40 eventos de pagamento pendente enviados pela Kiwify."
      emptyState="Ainda não recebemos webhooks de pagamento pendente. Aguarde novas tentativas da Kiwify."
      events={events}
    />
  );
}
