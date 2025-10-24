import { formatISO } from "date-fns";

import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { formatKiwifyApiPath, KiwifyApiError } from "@/lib/kiwify/client";
import { listAllSales } from "@/lib/kiwify/resources";

export const dynamic = "force-dynamic";

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
    const today = formatISO(new Date(), { representation: "date" });
    sales = await listAllSales({ startDate: "2020-01-01", endDate: today });
  } catch (err) {
    console.error("Erro ao consultar vendas na Kiwify", err);

    const defaultMessage = "Não foi possível listar as vendas. Ajuste filtros ou valide o token.";
    let message = defaultMessage;

    if (err instanceof KiwifyApiError) {
      const details = (err.details ?? null) as { type?: string } | null;

      if (err.status === 400 && details?.type === "validation_error") {
        message = "Nenhuma venda encontrada no período informado";
      }
    }

    error = message;
  }

  const salesPath = formatKiwifyApiPath("sales");

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Vendas consolidadas</h3>
        <p className="text-sm text-muted-foreground">
          Use a API para auditar pedidos além dos webhooks, consultar status de cobrança, formas de pagamento, split e
          comissão da Kiwify. A resposta segue os contratos descritos em {salesPath}.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <JsonPreview title={`Lista de vendas (GET ${salesPath})`} data={sales} />
      )}
    </div>
  );
}
