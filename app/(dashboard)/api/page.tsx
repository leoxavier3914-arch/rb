import { JsonPreview } from "@/components/json-preview";
import { StatCard } from "@/components/stat-card";
import { kiwifyApiEnv } from "@/lib/env";
import { getKiwifyApiPathPrefix, getPartnerIdFromEnv } from "@/lib/kiwify/client";

export const dynamic = "force-dynamic";

export default function ApiOverviewPage() {
  const env = kiwifyApiEnv.maybe();
  const partnerId = getPartnerIdFromEnv();
  const pathPrefix = getKiwifyApiPathPrefix();
  const envConfigured = Boolean(env);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Configuração"
          value={envConfigured ? "Variáveis carregadas" : "Configuração pendente"}
          helper="Defina as variáveis no painel do Vercel para acessar a API oficial."
        />
        <StatCard
          label="Endpoint base"
          value={env?.KIWIFY_API_BASE_URL ?? "—"}
          helper={
            envConfigured
              ? `Prefixo aplicado: ${pathPrefix || "/"}`
              : "Utilizado para construir todas as requisições."
          }
        />
        <StatCard
          label="Partner ID"
          value={partnerId ?? "—"}
          helper="Obrigatório para relatórios financeiros de afiliados."
        />
      </div>

      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Escopo de monitoramento</h3>
        <p className="text-sm text-muted-foreground">
          Esta área centraliza os recursos descritos na documentação oficial da Kiwify, incluindo autenticação OAuth,
          consulta de conta, cadastro e atualização de produtos, leitura de vendas, conciliação financeira, gestão de
          afiliados, acompanhamento de webhooks e listagem de participantes matriculados.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Gere tokens Client Credentials diretamente do painel e visualize a validade atual.</li>
          <li>Sincronize dados de conta, catálogo, vendas e finanças com filtros idênticos aos da API.</li>
          <li>Envie comandos seguros para criar ou atualizar produtos usando o mesmo payload aceito pela Kiwify.</li>
          <li>Audite webhooks oficiais e cruze com a ingestão já armazenada no hub.</li>
          <li>Acesse a listagem de participantes por produto para suporte e controle de acesso.</li>
        </ul>
      </section>

      <JsonPreview
        title="Variáveis de ambiente detectadas"
        data={{
          base_url: env?.KIWIFY_API_BASE_URL,
          client_id: env?.KIWIFY_CLIENT_ID ? `${env.KIWIFY_CLIENT_ID.slice(0, 6)}…` : null,
          account_id: env?.KIWIFY_ACCOUNT_ID ?? null,
          scope: env?.KIWIFY_API_SCOPE ?? null,
          audience: env?.KIWIFY_API_AUDIENCE ?? null,
          path_prefix: envConfigured ? pathPrefix || "/" : null,
          partner_id: env?.KIWIFY_PARTNER_ID ?? null,
        }}
        emptyState="Nenhuma variável carregada. Configure as chaves no projeto do Vercel."
      />
    </div>
  );
}
