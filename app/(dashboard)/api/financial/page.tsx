import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { formatKiwifyApiPath } from "@/lib/kiwify/client";
import { fetchFinancialSummary, listWithdrawals } from "@/lib/kiwify/resources";

export const dynamic = "force-dynamic";

export default async function FinancialPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para acompanhar saldo, repasses e solicitações de saque enviados à Kiwify.
      </div>
    );
  }

  let summary: unknown = null;
  let withdrawals: unknown = null;
  let error: string | null = null;

  try {
    [summary, withdrawals] = await Promise.all([
      fetchFinancialSummary(),
      listWithdrawals({ perPage: 25 }),
    ]);
  } catch (err) {
    console.error("Erro ao consultar dados financeiros na Kiwify", err);
    error = "Não foi possível carregar as informações financeiras. Revise o token e permissões de conta.";
  }

  const summaryPath = formatKiwifyApiPath("financial/summary");
  const withdrawalsPath = formatKiwifyApiPath("financial/withdrawals");

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Financeiro em tempo real</h3>
        <p className="text-sm text-muted-foreground">
          Consulte o saldo disponível, valores bloqueados, taxas e histórico de saques exatamente como a Kiwify exibe no
          painel administrativo. Os dados seguem o contrato de {summaryPath} e {withdrawalsPath}.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <JsonPreview title={`Resumo financeiro (GET ${summaryPath})`} data={summary} />
          <JsonPreview title={`Histórico de saques (GET ${withdrawalsPath})`} data={withdrawals} />
        </div>
      )}
    </div>
  );
}
