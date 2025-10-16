import { EventsBoard } from "@/components/events-board";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAbandonedCarts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AbandonedCartsPage() {
  const { records, potentialAmount, totalCount, lastEvent } = await getAbandonedCarts();

  const events = records.map((cart) => ({
    id: cart.id,
    title: cart.customer_name ?? cart.customer_email ?? "Cliente desconhecido",
    subtitle: cart.product_name ?? "Produto não identificado",
    amount: formatCurrency(cart.amount, cart.currency) ?? undefined,
    badge: cart.status?.toUpperCase() ?? null,
    occurredAt: cart.occurred_at ?? cart.created_at,
    meta: cart.checkout_url ?? undefined,
  }));

  const currency = records[0]?.currency;

  return (
    <EventsBoard
      stats={[
        { label: "Abandonos registrados", value: totalCount.toString() },
        {
          label: "Potencial em aberto",
          value: formatCurrency(potentialAmount, currency) ?? "—",
          helper: "Estimativa baseada nas últimas oportunidades",
        },
        {
          label: "Último abandono",
          value: lastEvent ? formatDate(lastEvent) ?? "—" : "—",
          helper: "Acompanhe os ganchos para réguas de recuperação",
        },
      ]}
      heading="Oportunidades recentes"
      description="Carrinhos sinalizados pelos webhooks de abandono da Kiwify."
      emptyState="Nenhum abandono registrado até agora. Assim que a Kiwify enviar o webhook, ele aparecerá aqui."
      events={events}
    />
  );
}
