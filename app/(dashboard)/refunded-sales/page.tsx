import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { getRefundedSales } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RefundedSalesPage() {
  const {
    records,
    totalAmount,
    totalGrossAmount,
    totalKiwifyCommissionAmount,
    totalAffiliateCommissionAmount,
    totalCount,
    lastEvent,
  } = await getRefundedSales();

  const events = records.map((sale) => {
    const netDisplay = formatCurrency(sale.net_amount ?? sale.amount, sale.currency);
    const grossDisplay = formatCurrency(sale.gross_amount ?? sale.amount, sale.currency);
    const kiwifyDisplay = formatCurrency(sale.kiwify_commission_amount, sale.currency);
    const affiliateDisplay = formatCurrency(sale.affiliate_commission_amount, sale.currency);

    const details = [
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
    />
  );
}
