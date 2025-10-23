import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/format";
import {
  getSalesStatistics,
  hasKiwifyApiConfig,
  type SalesStatisticsBreakdownItem,
} from "@/lib/kiwify-api";

export const dynamic = "force-dynamic";

const formatValue = (value: number | null, currency: string | null) => {
  if (value === null) {
    return "—";
  }

  return formatCurrency(value, currency) ?? "—";
};

export default async function AnalyticsPage() {
  const hasApiConfig = hasKiwifyApiConfig();
  const stats = hasApiConfig ? await getSalesStatistics({ groupBy: "day" }) : null;
  const currency = stats?.totals.currency ?? "BRL";

  const cards = stats
    ? [
        {
          label: "Faturamento bruto",
          value: formatValue(stats.totals.grossAmount, currency),
          helper: "Total consolidado pela API oficial da Kiwify",
        },
        {
          label: "Faturamento líquido",
          value: formatValue(stats.totals.netAmount, currency),
        },
        {
          label: "Pedidos confirmados",
          value: stats.totals.totalOrders.toLocaleString("pt-BR"),
        },
        {
          label: "Ticket médio",
          value: formatValue(stats.totals.averageTicket, currency),
        },
        {
          label: "Comissão Kiwify",
          value: formatValue(stats.totals.kiwifyCommission, currency),
        },
        {
          label: "Comissão de afiliados",
          value: formatValue(stats.totals.affiliateCommission, currency),
        },
      ]
    : [];

  const breakdownRows = stats?.breakdown ?? [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Estatísticas</span>
        <h2 className="text-2xl font-semibold text-primary-foreground sm:text-3xl">
          Resumo histórico de vendas
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Consulta direta na API oficial da Kiwify para liberar dados completos de faturamento,
          pedidos e comissões, sem ficar limitado aos últimos webhooks recebidos pelo hub.
        </p>
      </header>

      {!hasApiConfig ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-surface/60 p-6 text-sm text-muted-foreground">
          Informe <code className="rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_CLIENT_ID</code>,
          <code className="ml-1 rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_CLIENT_SECRET</code> e
          <code className="ml-1 rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_ACCOUNT_ID</code> nas variáveis de
          ambiente para habilitar as estatísticas oficiais da Kiwify.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} helper={card.helper} />
            ))}
          </div>

          {stats?.error ? (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {stats.error}
            </p>
          ) : null}

          <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-primary-foreground">Linha do tempo</h3>
              <p className="text-sm text-muted-foreground">
                Evolução diária com base no agrupamento retornado pela API de estatísticas da Kiwify.
              </p>
            </header>
            {breakdownRows.length === 0 ? (
              <p className="rounded-2xl border border-surface-accent/40 bg-surface/70 p-6 text-sm text-muted-foreground">
                Nenhum dado retornado pela API até o momento. Assim que houver vendas registradas, o histórico aparecerá aqui.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-accent/60 text-sm">
                  <thead className="bg-surface-accent/40 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Período</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Pedidos</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Bruto</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-accent/40">
                    {breakdownRows.map((row: SalesStatisticsBreakdownItem) => (
                      <tr key={`${row.label}-${row.currency}`}>
                        <td className="px-4 py-3 text-left text-primary-foreground">{row.label}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                          {row.orders !== null ? row.orders.toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-primary-foreground">
                          {formatValue(row.grossAmount, row.currency ?? currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-primary-foreground">
                          {formatValue(row.netAmount, row.currency ?? currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
