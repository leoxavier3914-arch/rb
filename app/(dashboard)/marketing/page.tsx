import { StatCard } from "@/components/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCampaignPerformance } from "@/lib/queries";
import { getPixelEvents, hasKiwifyApiConfig } from "@/lib/kiwify-api";

export const dynamic = "force-dynamic";

const formatAmount = (value: number, currency: string | null) => {
  const formatted = formatCurrency(value, currency);
  return formatted ?? "—";
};

export default async function MarketingPage() {
  const campaignPerformance = await getCampaignPerformance();
  const hasApiConfig = hasKiwifyApiConfig();
  const pixelResult = hasApiConfig ? await getPixelEvents() : null;

  const pixelEvents = pixelResult?.events ?? [];
  const pixelError = pixelResult?.error;
  const pixelCurrency = pixelResult?.currency ?? "BRL";

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Marketing & Pixel</span>
        <h2 className="text-2xl font-semibold text-primary-foreground sm:text-3xl">
          Conciliação de UTMs com eventos do Pixel da Kiwify
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Cruzamos o desempenho das campanhas salvo nos webhooks com os disparos oficiais do Pixel para enxergar funil completo
          e oportunidades de recuperação.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Receita atribuída"
          value={formatAmount(pixelResult?.totalAmount ?? 0, pixelCurrency)}
          helper="Somatório de todos os eventos recebidos pelo Pixel"
        />
        <StatCard
          label="Eventos de Pixel"
          value={pixelEvents.length.toLocaleString("pt-BR")}
          helper="Conversões únicas rastreadas pela integração oficial"
        />
        <StatCard
          label="Campanhas acompanhadas"
          value={campaignPerformance.rows.length.toLocaleString("pt-BR")}
          helper="Agrupamento por combinação de UTM source/medium/campaign"
        />
      </div>

      {!hasApiConfig ? (
        <p className="rounded-2xl border border-dashed border-primary/40 bg-surface/60 p-6 text-sm text-muted-foreground">
          Configure <code className="rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_TOKEN</code> e
          <code className="ml-1 rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_ACCOUNT_ID</code> para habilitar os eventos do
          Pixel diretamente no hub.
        </p>
      ) : null}

      {pixelError ? (
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{pixelError}</p>
      ) : null}

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-primary-foreground">Top campanhas por faturamento líquido</h3>
          <p className="text-sm text-muted-foreground">
            Extraídas do Supabase a partir das UTMs recebidas nos webhooks de venda aprovada.
          </p>
        </header>
        {campaignPerformance.rows.length === 0 ? (
          <p className="rounded-2xl border border-surface-accent/40 bg-surface/70 p-6 text-sm text-muted-foreground">
            Ainda não recebemos campanhas com UTMs suficientes para montar o ranking.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-accent/60 text-sm">
              <thead className="bg-surface-accent/40 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left">UTM Source</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">UTM Medium</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">UTM Campaign</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Pedidos</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Faturamento líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-accent/40">
                {campaignPerformance.rows.map((row) => (
                  <tr
                    key={`${row.utmSource ?? ""}-${row.utmMedium ?? ""}-${row.utmCampaign ?? ""}`}
                  >
                    <td className="px-4 py-3 text-primary-foreground">{row.utmSource ?? "—"}</td>
                    <td className="px-4 py-3 text-primary-foreground">{row.utmMedium ?? "—"}</td>
                    <td className="px-4 py-3 text-primary-foreground">{row.utmCampaign ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                      {row.totalOrders.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-primary-foreground">
                      {formatAmount(row.netAmount, pixelCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pixelEvents.length > 0 ? (
        <section className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-primary-foreground">Últimos eventos do Pixel</h3>
            <p className="text-sm text-muted-foreground">
              Consolidado diretamente da API da Kiwify para cruzar valores com o funil das campanhas.
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-accent/60 text-sm">
              <thead className="bg-surface-accent/40 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Evento</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Campanha</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">UTMs</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left">Data</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-accent/40">
                {pixelEvents.map((event) => (
                  <tr key={event.id ?? `${event.eventName}-${event.occurredAt}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-primary-foreground">{event.eventName ?? "Evento"}</span>
                        <span className="text-xs text-muted-foreground">Pixel {event.pixelId ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-primary-foreground">{event.campaign ?? event.utmCampaign ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <span className="block">UTM Source: {event.utmSource ?? "—"}</span>
                      <span className="block">UTM Medium: {event.utmMedium ?? "—"}</span>
                      <span className="block">UTM Campaign: {event.utmCampaign ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(event.occurredAt) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-primary-foreground">
                      {event.amount !== null
                        ? formatAmount(event.amount, event.currency ?? pixelCurrency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
