import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { fetchAccountOverview } from "@/lib/kiwify/resources";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para consultar os dados cadastrais da loja na Kiwify.
      </div>
    );
  }

  let account: unknown = null;
  let error: string | null = null;

  try {
    account = await fetchAccountOverview();
  } catch (err) {
    console.error("Erro ao consultar conta na Kiwify", err);
    error = "Não foi possível carregar os dados da conta. Verifique as credenciais e permissões.";
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Conta e responsáveis</h3>
        <p className="text-sm text-muted-foreground">
          A consulta de conta devolve informações cadastrais como razão social, documentos, contatos e configurações
          fiscais. Utilize esses dados para validar se as informações públicas estão sincronizadas e para auditoria de
          acesso.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <JsonPreview title="Resposta de /v1/account" data={account} />
      )}
    </div>
  );
}
