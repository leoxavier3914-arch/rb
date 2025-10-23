import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { listSales } from "@/lib/kiwify/resources";

export default async function SalesPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para acompanhar pedidos e vendas registrados na Kiwify.
      </div>
    );
  }

  let sales: unknown = null;
  let error: string | null = null;

  try {
    sales = await listSales({ perPage: 40 });
  } catch (err) {
    console.error("Erro ao consultar vendas na Kiwify", err);
    error = "Não foi possível listar as vendas. Ajuste filtros ou valide o token.";
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Vendas consolidadas</h3>
        <p className="text-sm text-muted-foreground">
          Use a API para auditar pedidos além dos webhooks, consultar status de cobrança, formas de pagamento, split e
          comissão da Kiwify. A resposta segue os contratos descritos em /v1/sales.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <JsonPreview title="Lista de vendas (GET /v1/sales)" data={sales} />
      )}
    </div>
  );
}
