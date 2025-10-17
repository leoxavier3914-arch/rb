import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatSaleStatus } from "@/lib/sale-event-metadata";
import { getRejectedPayments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RejectedPaymentsPage() {
  const {
    records,
    totalAmount,
    totalGrossAmount,
    totalKiwifyCommissionAmount,
    totalAffiliateCommissionAmount,
    totalCount,
    lastEvent,
  } = await getRejectedPayments();

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
      href: sale.sale_id ? `/sales/${encodeURIComponent(sale.sale_id)}` : undefined,
      details,
    };
  });

  const currency = records[0]?.currency;

  const stats = [
    { label: "Pagamentos recusados", value: totalCount.toString() },
    {
      label: "Valor líquido perdido",
      value: formatCurrency(totalAmount, currency) ?? "—",
      helper: "Estimativa do que deixou de entrar",
    },
    {
      label: "Valor cheio recusado",
      value: formatCurrency(totalGrossAmount, currency) ?? "—",
      helper: "Preço integral das tentativas rejeitadas",
    },
    {
      label: "Comissão Kiwify envolvida",
      value: formatCurrency(totalKiwifyCommissionAmount, currency) ?? "—",
      helper: "Taxas associadas às recusas registradas",
    },
  ];

  if (totalAffiliateCommissionAmount > 0) {
    stats.push({
      label: "Comissão de afiliados",
      value: formatCurrency(totalAffiliateCommissionAmount, currency) ?? "—",
      helper: "Repasse que seria destinado aos parceiros",
    });
  }

  stats.push({
    label: "Última recusa",
    value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
    helper: "Atualize para verificar novos webhooks",
  });

  return (
    <EventsBoard
      stats={stats}
      heading="Recusas mais recentes"
      description="Listagem limitada aos últimos 40 eventos de pagamento recusado enviados pela Kiwify."
      emptyState="Nenhum pagamento recusado registrado até agora. Aguarde o primeiro webhook de recusa da Kiwify."
      events={events}
    />
  );
}
