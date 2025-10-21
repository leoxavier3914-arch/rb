import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { parseEventFilters } from "@/lib/event-filters";
import { formatSaleStatus } from "@/lib/sale-event-metadata";
import { getRefundedSales } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface RefundedSalesPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function RefundedSalesPage({ searchParams }: RefundedSalesPageProps) {
  const { filters, values } = parseEventFilters(searchParams);

  const {
    records,
    totalAmount,
    totalGrossAmount,
    totalKiwifyCommissionAmount,
    totalAffiliateCommissionAmount,
    totalCount,
    lastEvent,
  } = await getRefundedSales({ filters });

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
        ? `/sales/${encodeURIComponent(sale.sale_id)}?entry=${encodeURIComponent(sale.id)}`
        : undefined,
      details,
    };
  });

  const currency = records[0]?.currency;

  const stats = [
    { label: "Total de reembolsos", value: totalCount.toString() },
    {
      label: "Valor líquido devolvido",
      value: formatCurrency(totalAmount, currency) ?? "—",
      helper: "Somatório das últimas devoluções que impactaram sua receita",
    },
    {
      label: "Valor cheio reembolsado",
      value: formatCurrency(totalGrossAmount, currency) ?? "—",
      helper: "Preço integral original das vendas reembolsadas",
    },
    {
      label: "Comissão Kiwify estornada",
      value: formatCurrency(totalKiwifyCommissionAmount, currency) ?? "—",
      helper: "Taxas associadas às vendas reembolsadas",
    },
  ];

  if (totalAffiliateCommissionAmount > 0) {
    stats.push({
      label: "Comissão de afiliados",
      value: formatCurrency(totalAffiliateCommissionAmount, currency) ?? "—",
      helper: "Valores repassados a parceiros nessas devoluções",
    });
  }

  stats.push({
    label: "Último reembolso",
    value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
    helper: "Atualize a página para sincronizar novos eventos",
  });

  return (
    <EventsBoard
      stats={stats}
      heading="Reembolsos mais recentes"
      description="Listagem limitada aos últimos 40 eventos enviados pela Kiwify."
      emptyState="Nenhum reembolso recebido até o momento. Aguarde o primeiro webhook de reembolso da Kiwify."
      events={events}
      filterAction="/refunded-sales"
      filters={values}
    />
  );
}
