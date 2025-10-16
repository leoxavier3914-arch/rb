import { EventCard } from "@/components/event-card";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { getRejectedPayments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RejectedPaymentsPage() {
  const { records, totalAmount, totalCount, lastEvent } = await getRejectedPayments();

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pagamentos recusados" value={totalCount.toString()} />
        <StatCard
          label="Valor perdido"
          value={formatCurrency(totalAmount, records[0]?.currency) ?? "—"}
          helper="Somatório dos pagamentos recusados recentemente"
        />
        <StatCard
          label="Última recusa"
          value={lastEvent ? formatDate(lastEvent) ?? "—" : "—"}
          helper="Atualize para verificar novos webhooks"
        />
      </div>

      <div className="space-y-4">
        <header className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-primary-foreground">Recusas mais recentes</h2>
          <p className="text-sm text-muted-foreground">
            Listagem limitada aos últimos 40 eventos de pagamento recusado enviados pela Kiwify.
          </p>
        </header>

        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-accent/50 bg-surface/60 p-10 text-center text-sm text-muted-foreground">
              Nenhum pagamento recusado registrado até agora. Aguarde o primeiro webhook de recusa da Kiwify.
            </div>
          ) : (
            records.map((sale) => (
              <EventCard
                key={sale.id}
                title={sale.product_name ?? "Produto sem nome"}
                subtitle={sale.customer_name ?? sale.customer_email ?? "Cliente desconhecido"}
                amount={formatCurrency(sale.amount, sale.currency) ?? undefined}
                badge={sale.payment_method?.toUpperCase() ?? null}
                occurredAt={sale.occurred_at ?? sale.created_at}
                meta={sale.sale_id ?? undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
