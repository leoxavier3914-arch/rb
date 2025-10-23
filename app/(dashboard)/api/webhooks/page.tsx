import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { formatKiwifyApiPath } from "@/lib/kiwify/client";
import { listWebhooks, listWebhooksDeliveries } from "@/lib/kiwify/resources";

export const dynamic = "force-dynamic";

export default async function WebhooksApiPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para consultar as configurações e históricos de entrega dos webhooks oficiais.
      </div>
    );
  }

  let webhooks: unknown = null;
  let deliveries: unknown = null;
  let error: string | null = null;

  try {
    [webhooks, deliveries] = await Promise.all([
      listWebhooks({ perPage: 25 }),
      listWebhooksDeliveries({ perPage: 25 }),
    ]);
  } catch (err) {
    console.error("Erro ao consultar webhooks via API da Kiwify", err);
    error = "Não foi possível carregar as informações dos webhooks. Valide o token e as permissões.";
  }

  const eventsPath = formatKiwifyApiPath("webhooks/events");
  const deliveriesPath = formatKiwifyApiPath("webhooks/deliveries");

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Integrações e auditoria</h3>
        <p className="text-sm text-muted-foreground">
          Compare as configurações da API oficial ({eventsPath} e {deliveriesPath}) com os eventos armazenados pelo hub. Essa
          visão facilita identificar falhas de entrega, tentativas e endpoints configurados diretamente na Kiwify.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <JsonPreview title={`Configuração de webhooks (GET ${eventsPath})`} data={webhooks} />
          <JsonPreview title={`Histórico de entregas (GET ${deliveriesPath})`} data={deliveries} />
        </div>
      )}
    </div>
  );
}
