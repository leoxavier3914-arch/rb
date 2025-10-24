import { headers } from "next/headers";

import { JsonPreview } from "@/components/json-preview";
import { StatCard } from "@/components/stat-card";
import { hasKiwifyApiEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { formatCentsBRL } from "@/lib/format/currency";
import { formatPercentAuto } from "@/lib/format/percent";

export const dynamic = "force-dynamic";

type BalancePayload = {
  available?: number | string | { amount?: number | string; currency?: string | null } | null;
  pending?: number | string | { amount?: number | string; currency?: string | null } | null;
  legal_entity_id?: string | null;
  currency?: string | null;
};

type PayoutEntry = {
  id?: string;
  amount?: number | string | null;
  status?: string | null;
  created_at?: string | null;
  currency?: string | null;
  price?: number | string | null;
};

type FinancialSummary = {
  balance?: BalancePayload | null;
  payouts?: {
    data?: PayoutEntry[] | null;
    pagination?: Record<string, unknown> | null;
  } | null;
  stats?: Record<string, unknown> | null;
};

type PercentStatEntry = {
  key: string;
  label: string;
  value: unknown;
  helper?: string;
};

function parseCents(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractAmount(entry: BalancePayload[keyof BalancePayload]) {
  if (entry === null || entry === undefined) {
    return null;
  }

  if (typeof entry === "number" || typeof entry === "string") {
    return parseCents(entry);
  }

  if (typeof entry === "object") {
    return parseCents(entry.amount);
  }

  return null;
}

const PERCENT_STAT_LABELS: Record<string, { label: string; helper?: string }> = {
  credit_card_approval_rate: {
    label: "Aprovação no cartão de crédito",
    helper: "Pedidos aprovados com cartão no período consultado.",
  },
  boleto_approval_rate: {
    label: "Aprovação no boleto",
    helper: "Boletos compensados entre os pedidos emitidos.",
  },
  pix_approval_rate: {
    label: "Aprovação no PIX",
    helper: "Proporção de pagamentos PIX confirmados.",
  },
  refund_rate: {
    label: "Taxa de reembolsos",
    helper: "Percentual de pedidos reembolsados.",
  },
  chargeback_rate: {
    label: "Taxa de chargeback",
    helper: "Pedidos contestados em relação ao total de vendas.",
  },
  subscription_renewal_rate: {
    label: "Renovação de assinaturas",
    helper: "Assinaturas renovadas automaticamente.",
  },
  conversion_rate: {
    label: "Taxa de conversão",
    helper: "Conversões sobre acessos ou leads coletados.",
  },
};

function humanizeStatKey(key: string) {
  return key
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

async function fetchFinancialSummaryFromApi(): Promise<FinancialSummary> {
  const headerList = headers();
  const forwardedProto = headerList.get("x-forwarded-proto");
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host");
  const protocol = forwardedProto ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  if (!host) {
    throw new Error("Não foi possível determinar o host para consultar /api/financial");
  }

  const url = `${protocol}://${host}/api/financial/summary`;
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Falha ao consultar /api/financial/summary: ${response.status}`);
  }

  return (await response.json()) as FinancialSummary;
}

export default async function FinancialPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para acompanhar saldo, repasses e solicitações de saque enviados à Kiwify.
      </div>
    );
  }

  let summary: FinancialSummary | null = null;
  let error: string | null = null;

  try {
    summary = await fetchFinancialSummaryFromApi();
  } catch (err) {
    console.error("Erro ao consultar dados financeiros na rota interna /api/financial/summary", err);
    error =
      "Não foi possível carregar as informações financeiras. Revise o token, permissões de conta ou tente novamente em instantes.";
  }

  const balance = summary?.balance ?? {};
  const availableCents = extractAmount(balance.available);
  const pendingCents = extractAmount(balance.pending);
  const legalEntityId = balance.legal_entity_id ?? null;
  const payouts = summary?.payouts?.data ?? [];
  const stats = summary?.stats ?? null;
  const labeledPercentStatEntries: PercentStatEntry[] = stats
    ? Object.entries(PERCENT_STAT_LABELS).flatMap(([key, meta]) => {
        const value = stats?.[key];
        if (value === null || value === undefined) {
          return [];
        }
        return [
          {
            key,
            label: meta.label,
            helper: meta.helper,
            value,
          } satisfies PercentStatEntry,
        ];
      })
    : [];

  const dynamicPercentStatEntries: PercentStatEntry[] = stats
    ? Object.entries(stats)
        .filter(([key, value]) =>
          (key.endsWith("_rate") || key.endsWith("_percentage")) &&
          !(key in PERCENT_STAT_LABELS) &&
          value !== null &&
          value !== undefined,
        )
        .map(
          ([key, value]) =>
            ({ key, label: humanizeStatKey(key), value } satisfies PercentStatEntry),
        )
    : [];

  const percentStatEntries: PercentStatEntry[] = [
    ...labeledPercentStatEntries,
    ...dynamicPercentStatEntries,
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Financeiro em tempo real</h3>
        <p className="text-sm text-muted-foreground">
          Consulte o saldo disponível, valores pendentes de liberação e histórico recente de repasses diretamente da API
          pública da Kiwify.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Saldo disponível"
              value={formatCentsBRL(availableCents)}
              helper={
                legalEntityId
                  ? `Conta favorecida: ${legalEntityId}`
                  : "Valores liberados para saque imediato na Kiwify."
              }
            />
            <StatCard
              label="Saldo pendente"
              value={formatCentsBRL(pendingCents)}
              helper="Valores aguardando liberação conforme regras da Kiwify."
            />
            <StatCard
              label="Próxima atualização"
              value={new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              helper="Os dados são consultados em tempo real sempre que a página é carregada."
            />
          </div>

          {percentStatEntries.length > 0 ? (
            <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-lg font-semibold text-white">Indicadores de performance</h4>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {percentStatEntries.length} métricas
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {percentStatEntries.map((entry) => (
                  <StatCard
                    key={entry.key}
                    label={entry.label}
                    value={formatPercentAuto(entry.value)}
                    helper={entry.helper}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-semibold text-white">Últimos saques</h4>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{payouts.length} registros</span>
            </div>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum saque encontrado nos últimos lançamentos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/5 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Solicitado em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payouts.map((payout) => {
                      const payoutCents = parseCents(payout.amount) ?? parseCents(payout.price);
                      const amountDisplay = formatCentsBRL(payoutCents);
                      const statusDisplay = payout.status ?? "—";
                      const createdAtDisplay = formatDate(payout.created_at) ?? "—";

                      return (
                        <tr key={payout.id ?? `${payout.created_at}-${payout.amount}`} className="text-muted-foreground">
                          <td className="px-3 py-2 font-mono text-xs text-white/80">
                            {payout.id ? payout.id.slice(0, 12) : "—"}
                          </td>
                          <td className="px-3 py-2 text-white">{amountDisplay}</td>
                          <td className="px-3 py-2 capitalize">{statusDisplay}</td>
                          <td className="px-3 py-2">{createdAtDisplay}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <JsonPreview title="Estatísticas de vendas (/v1/stats)" data={stats} emptyState="Nenhuma estatística encontrada." />
        </div>
      )}
    </div>
  );
}
