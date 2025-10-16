import { EventCard } from "@/components/event-card";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAbandonedCarts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AbandonedCartsPage() {
  const { records, potentialAmount, totalCount, lastEvent } = await getAbandonedCarts();

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Abandonos registrados" value={totalCount.toString()} />
        <StatCard
          label="Potencial em aberto"
          value={formatCurrency(potentialAmount, records[0]?.currency) ?? "—"}
          helper="Estimativa baseada nas últimas oportunidades"
        />
        <StatCard
          label="Último abandono"
          value={lastEvent ? formatDate(lastEvent) ?? "—" : "—"}
          helper="Acompanhe os ganchos para réguas de recuperação"
        />
      </div>

      <div className="space-y-4">
        <header className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-primary-foreground">Oportunidades recentes</h2>
          <p className="text-sm text-muted-foreground">
            Carrinhos sinalizados pelos webhooks de abandono da Kiwify.
          </p>
        </header>

        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-accent/50 bg-surface/60 p-10 text-center text-sm text-muted-foreground">
              Nenhum abandono registrado até agora. Assim que a Kiwify enviar o webhook, ele aparecerá aqui.
            </div>
          ) : (
            records.map((cart) => (
              <EventCard
                key={cart.id}
                title={cart.customer_name ?? cart.customer_email ?? "Cliente desconhecido"}
                subtitle={cart.product_name ?? "Produto não identificado"}
                amount={formatCurrency(cart.amount, cart.currency) ?? undefined}
                badge={cart.status?.toUpperCase() ?? null}
                occurredAt={cart.occurred_at ?? cart.created_at}
                meta={cart.checkout_url ?? undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
