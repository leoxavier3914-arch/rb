import { formatCurrency, formatDate } from "@/lib/format";
import {
  getKiwifyEnrollments,
  getKiwifySubscriptions,
  hasKiwifyApiConfig,
  type KiwifyEnrollmentSummary,
  type KiwifySubscriptionSummary,
} from "@/lib/kiwify-api";

export const dynamic = "force-dynamic";

const formatAmount = (subscription: KiwifySubscriptionSummary) => {
  if (subscription.amount === null) {
    return "—";
  }

  return formatCurrency(subscription.amount, subscription.currency) ?? "—";
};

export default async function SubscriptionsPage() {
  const hasApiConfig = hasKiwifyApiConfig();
  const [subscriptionsResult, enrollmentsResult] = hasApiConfig
    ? await Promise.all([getKiwifySubscriptions(), getKiwifyEnrollments()])
    : [null, null];

  const subscriptions = subscriptionsResult?.subscriptions ?? [];
  const enrollments = enrollmentsResult?.enrollments ?? [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Assinaturas & Área do aluno</span>
        <h2 className="text-2xl font-semibold text-primary-foreground sm:text-3xl">
          Controle unificado de recorrências e matrículas
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Sincronizamos planos, status e cobranças diretamente com a API de assinaturas e listamos também quem está ativo na área
          do aluno para facilitar ações de suporte.
        </p>
      </header>

      {!hasApiConfig ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-surface/60 p-6 text-sm text-muted-foreground">
          Adicione <code className="rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_CLIENT_ID</code>,
          <code className="ml-1 rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_CLIENT_SECRET</code> e
          <code className="ml-1 rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_ACCOUNT_ID</code> nas variáveis de ambiente
          para ativar os dados de assinaturas e alunos.
        </div>
      ) : (
        <>
          {subscriptionsResult?.error ? (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {subscriptionsResult.error}
            </p>
          ) : null}

          <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-primary-foreground">Assinaturas</h3>
              <p className="text-sm text-muted-foreground">
                Status, cliente e próxima cobrança sincronizados em tempo real com a Kiwify.
              </p>
            </header>
            {subscriptions.length === 0 ? (
              <p className="rounded-2xl border border-surface-accent/40 bg-surface/70 p-6 text-sm text-muted-foreground">
                Nenhuma assinatura retornada pela API até agora.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-accent/60 text-sm">
                  <thead className="bg-surface-accent/40 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Cliente</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Plano</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Valor</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Próxima cobrança</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Última cobrança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-accent/40">
                    {subscriptions.map((subscription: KiwifySubscriptionSummary) => (
                      <tr key={subscription.id ?? `${subscription.customerEmail}-${subscription.planName}`}>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-primary-foreground">{subscription.customerName ?? "Cliente"}</span>
                            <span className="text-xs text-muted-foreground">{subscription.customerEmail ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-primary-foreground">{subscription.productName ?? "Produto"}</span>
                            <span className="text-xs text-muted-foreground">{subscription.planName ?? "Plano"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-primary-foreground">
                          {formatAmount(subscription)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {subscription.status ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(subscription.nextChargeAt) ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(subscription.lastChargeAt) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {enrollmentsResult?.error ? (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {enrollmentsResult.error}
            </p>
          ) : null}

          <section className="flex flex-col gap-4">
            <header className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-primary-foreground">Área do aluno</h3>
              <p className="text-sm text-muted-foreground">
                Consulte quem está com acesso ativo, progresso e último acesso sem sair do hub.
              </p>
            </header>
            {enrollments.length === 0 ? (
              <p className="rounded-2xl border border-surface-accent/40 bg-surface/70 p-6 text-sm text-muted-foreground">
                Nenhuma matrícula encontrada na API da Kiwify neste momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-accent/60 text-sm">
                  <thead className="bg-surface-accent/40 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Aluno</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Curso</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Progresso</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left">Última atividade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-accent/40">
                    {enrollments.map((enrollment: KiwifyEnrollmentSummary) => (
                      <tr key={enrollment.id ?? `${enrollment.studentEmail}-${enrollment.courseName}`}>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-primary-foreground">{enrollment.studentName ?? "Aluno"}</span>
                            <span className="text-xs text-muted-foreground">{enrollment.studentEmail ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-primary-foreground">{enrollment.courseName ?? "Curso"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {enrollment.progress !== null ? `${enrollment.progress}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(enrollment.lastActivityAt) ?? "—"}
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
