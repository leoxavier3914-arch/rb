import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatSaleStatus } from "@/lib/sale-event-metadata";
import { parseEventFilters } from "@/lib/event-filters";
import { getPendingPayments } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface PendingPaymentsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PendingPaymentsPage({ searchParams }: PendingPaymentsPageProps) {
  const { filters, values } = parseEventFilters(searchParams);

  const {
    records,
    totalAmount,
    totalGrossAmount,
    totalKiwifyCommissionAmount,
    totalAffiliateCommissionAmount,
    totalCount,
    lastEvent,
  } = await getPendingPayments({ filters });

  const events = records.map((sale) => {
    const netDisplay = formatCurrency(sale.net_amount ?? sale.amount, sale.currency);
    const grossDisplay = formatCurrency(sale.gross_amount ?? sale.amount, sale.currency);
    const kiwifyDisplay = formatCurrency(sale.kiwify_commission_amount, sale.currency);
    const affiliateDisplay = formatCurrency(sale.affiliate_commission_amount, sale.currency);

    const monetaryDetails = [
      grossDisplay && grossDisplay !== netDisplay
        ? { label: "Valor cheio", value: grossDisplay }
        : null,
      kiwifyDisplay ? { label: "Comissão Kiwify", value: kiwifyDisplay } : null,
      affiliateDisplay ? { label: "Comissão Afiliados", value: affiliateDisplay } : null,
    ].filter((detail): detail is { label: string; value: string } => detail !== null);

    const statusDisplay = formatSaleStatus(sale.status);
    const details = [
      ...monetaryDetails,
      ...(statusDisplay ? [{ label: "Status", value: statusDisplay }] : []),
    ];

    return {
      id: sale.id,
      title: sale.product_name ?? "Produto sem nome",
      subtitle: sale.customer_name ?? sale.customer_email ?? "Cliente desconhecido",
      amount: netDisplay ?? undefined,
      badge: sale.payment_method?.toUpperCase() ?? null,
      occurredAt: sale.occurred_at ?? sale.created_at,
      meta: sale.sale_id ?? undefined,
      href: sale.sale_id
        ? `/api/sales/${encodeURIComponent(sale.sale_id)}?entry=${encodeURIComponent(sale.id)}`
        : undefined,
      details,
    };
  });

  const currency = records[0]?.currency;

  const stats = [
    { label: "Pagamentos pendentes", value: totalCount.toString() },
    {
      label: "Valor líquido em aberto",
      value: formatCurrency(totalAmount, currency) ?? "—",
      helper: "Somatório do que pode entrar após confirmação",
    },
    {
      label: "Valor cheio aguardado",
      value: formatCurrency(totalGrossAmount, currency) ?? "—",
      helper: "Preço integral estimado dos pedidos pendentes",
    },
    {
      label: "Comissão Kiwify prevista",
      value: formatCurrency(totalKiwifyCommissionAmount, currency) ?? "—",
      helper: "Taxas ainda não capturadas",
    },
  ];

  if (totalAffiliateCommissionAmount > 0) {
    stats.push({
      label: "Comissão de afiliados",
      value: formatCurrency(totalAffiliateCommissionAmount, currency) ?? "—",
      helper: "Possível repasse aos parceiros",
    });
  }

  stats.push({
    label: "Última atualização",
    value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
    helper: "Atualize a página para sincronizar novos eventos",
  });

  return (
    <EventsBoard
      stats={stats}
      heading="Pendências em aberto"
      description="Listagem limitada aos últimos 40 eventos de pagamento pendente enviados pela Kiwify."
      emptyState="Ainda não recebemos webhooks de pagamento pendente. Aguarde novas tentativas da Kiwify."
      events={events}
      filterAction="/webhooks/pending-payments"
      filters={values}
    />
  );
}
