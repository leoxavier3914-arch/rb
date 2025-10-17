import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatSaleStatus } from "@/lib/sale-event-metadata";
import { getAbandonedCarts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AbandonedCartsPage() {
  const {
    records,
    potentialAmount,
    potentialGrossAmount,
    potentialKiwifyCommissionAmount,
    potentialAffiliateCommissionAmount,
    totalCount,
    lastEvent,
  } = await getAbandonedCarts();

  const events = records.map((cart) => {
    const netDisplay = formatCurrency(cart.net_amount ?? cart.amount, cart.currency);
    const grossDisplay = formatCurrency(cart.gross_amount ?? cart.amount, cart.currency);
    const kiwifyDisplay = formatCurrency(cart.kiwify_commission_amount, cart.currency);
    const affiliateDisplay = formatCurrency(cart.affiliate_commission_amount, cart.currency);

    const statusDisplay = formatSaleStatus(cart.status);

    const details = [
      grossDisplay && grossDisplay !== netDisplay
        ? { label: "Valor cheio", value: grossDisplay }
        : null,
      kiwifyDisplay ? { label: "Comissão Kiwify", value: kiwifyDisplay } : null,
      affiliateDisplay ? { label: "Comissão Afiliados", value: affiliateDisplay } : null,
      statusDisplay ? { label: "Status", value: statusDisplay } : null,
    ].filter((detail): detail is { label: string; value: string } => detail !== null);

    return {
      id: cart.id,
      title: cart.customer_name ?? cart.customer_email ?? "Cliente desconhecido",
      subtitle: cart.product_name ?? "Produto não identificado",
      amount: netDisplay ?? undefined,
      badge: cart.status?.toUpperCase() ?? null,
      occurredAt: cart.occurred_at ?? cart.created_at,
      meta: cart.checkout_url ?? undefined,
      details,
    };
  });

  const currency = records[0]?.currency;

  const stats = [
    { label: "Abandonos registrados", value: totalCount.toString() },
    {
      label: "Potencial líquido",
      value: formatCurrency(potentialAmount, currency) ?? "—",
      helper: "Estimativa do que pode virar receita",
    },
    {
      label: "Valor cheio potencial",
      value: formatCurrency(potentialGrossAmount, currency) ?? "—",
      helper: "Preço integral dos carrinhos abandonados",
    },
    {
      label: "Comissão Kiwify estimada",
      value: formatCurrency(potentialKiwifyCommissionAmount, currency) ?? "—",
      helper: "Taxas que seriam cobradas se recuperados",
    },
  ];

  if (potentialAffiliateCommissionAmount > 0) {
    stats.push({
      label: "Comissão de afiliados",
      value: formatCurrency(potentialAffiliateCommissionAmount, currency) ?? "—",
      helper: "Repasse previsto aos parceiros",
    });
  }

  stats.push({
    label: "Último abandono",
    value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
    helper: "Acompanhe os ganchos para réguas de recuperação",
  });

  return (
    <EventsBoard
      stats={stats}
      heading="Oportunidades recentes"
      description="Carrinhos sinalizados pelos webhooks de abandono da Kiwify."
      emptyState="Nenhum abandono registrado até agora. Assim que a Kiwify enviar o webhook, ele aparecerá aqui."
      events={events}
    />
  );
}
