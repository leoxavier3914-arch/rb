import { EventCard } from "@/components/event-card";
import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { getPendingPayments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PendingPaymentsPage() {
  const { records, totalAmount, totalCount, lastEvent } = await getPendingPayments();

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pagamentos pendentes" value={totalCount.toString()} />
        <StatCard
          label="Valor aguardando confirmação"
          value={formatCurrency(totalAmount, records[0]?.currency) ?? "—"}
          helper="Somatório das tentativas pendentes mais recentes"
        />
        <StatCard
          label="Última atualização"
          value={lastEvent ? formatDate(lastEvent) ?? "—" : "—"}
          helper="Atualize a página para sincronizar novos eventos"
        />
      </div>

      <div className="space-y-4">
        <header className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-primary-foreground">Pendências em aberto</h2>
          <p className="text-sm text-muted-foreground">
            Listagem limitada aos últimos 40 eventos de pagamento pendente enviados pela Kiwify.
          </p>
        </header>

        <div className="grid gap-4">
          {records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-accent/50 bg-surface/60 p-10 text-center text-sm text-muted-foreground">
              Ainda não recebemos webhooks de pagamento pendente. Aguarde novas tentativas da Kiwify.
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
