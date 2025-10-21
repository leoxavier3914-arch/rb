import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatSaleStatus } from "@/lib/sale-event-metadata";
import { parseEventFilters } from "@/lib/event-filters";
import { getApprovedSales } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface ApprovedSalesPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function ApprovedSalesPage({ searchParams }: ApprovedSalesPageProps) {
  const { filters, values } = parseEventFilters(searchParams);

  const {
    records,
    totalAmount,
    totalGrossAmount,
    totalKiwifyCommissionAmount,
    totalAffiliateCommissionAmount,
    totalCount,
    lastEvent,
  } = await getApprovedSales({ filters });

  const events = records.map((sale) => {
    const netDisplay = formatCurrency(sale.net_amount ?? sale.amount, sale.currency);
    const grossDisplay = formatCurrency(sale.gross_amount ?? sale.amount, sale.currency);
    const kiwifyDisplay = formatCurrency(sale.kiwify_commission_amount, sale.currency);
    const affiliateDisplay = formatCurrency(sale.affiliate_commission_amount, sale.currency);

    const statusDisplay = formatSaleStatus(sale.status);
    const details = [
      statusDisplay ? { label: "Status", value: statusDisplay } : null,
      grossDisplay && grossDisplay !== netDisplay
        ? { label: "Valor cheio", value: grossDisplay }
        : null,
      kiwifyDisplay ? { label: "Comissão Kiwify", value: kiwifyDisplay } : null,
      affiliateDisplay ? { label: "Comissão Afiliados", value: affiliateDisplay } : null,
    ].filter((detail): detail is { label: string; value: string } => detail !== null);

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
    { label: "Total de vendas", value: totalCount.toString() },
    {
      label: "Receita líquida",
      value: formatCurrency(totalAmount, currency) ?? "—",
      helper: "Somatório líquido considerando as últimas confirmações",
    },
    {
      label: "Valor cheio capturado",
      value: formatCurrency(totalGrossAmount, currency) ?? "—",
      helper: "Preço integral antes das taxas",
    },
    {
      label: "Comissão Kiwify",
      value: formatCurrency(totalKiwifyCommissionAmount, currency) ?? "—",
      helper: "Total retido pela Kiwify nos últimos eventos",
    },
  ];

  if (totalAffiliateCommissionAmount > 0) {
    stats.push({
      label: "Comissão de afiliados",
      value: formatCurrency(totalAffiliateCommissionAmount, currency) ?? "—",
      helper: "Repasse somado aos parceiros em destaque",
    });
  }

  stats.push({
    label: "Última confirmação",
    value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
    helper: "Atualize a página para forçar a sincronização",
  });

  return (
    <EventsBoard
      stats={stats}
      heading="Entradas mais recentes"
      description="Listagem limitada aos últimos 40 eventos confirmados pela Kiwify."
      emptyState="Ainda não recebemos vendas aprovadas. Aguardando o primeiro webhook da Kiwify."
      events={events}
      filterAction="/approved-sales"
      filters={values}
    />
  );
}
