import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { listAffiliates } from "@/lib/kiwify/resources";

export default async function AffiliatesPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para auditar afiliados, comissões e links de divulgação cadastrados na Kiwify.
      </div>
    );
  }

  let affiliates: unknown = null;
  let error: string | null = null;

  try {
    affiliates = await listAffiliates({ perPage: 50 });
  } catch (err) {
    console.error("Erro ao consultar afiliados na Kiwify", err);
    error = "Não foi possível listar afiliados. Revise permissões e filtros.";
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Gestão de afiliados</h3>
        <p className="text-sm text-muted-foreground">
          Mapeie afiliados ativos, links, cupons e repasses com a mesma estrutura disponibilizada no endpoint oficial
          (/v1/affiliates). Essas informações ajudam a conciliar comissões e a monitorar performance das campanhas.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <JsonPreview title="Lista de afiliados (GET /v1/affiliates)" data={affiliates} />
      )}
    </div>
  );
}
