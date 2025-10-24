import { JsonPreview } from "@/components/json-preview";
import { kiwifyApiEnv, hasKiwifyApiEnv } from "@/lib/env";
import { getAccessTokenMetadata } from "@/lib/kiwify/client";

import { TokenRefreshForm } from "./token-refresh-form";

export const dynamic = "force-dynamic";

export default async function AuthenticationPage() {
  const env = kiwifyApiEnv.maybe();
  const ready = hasKiwifyApiEnv();

  let metadata = null;

  if (ready) {
    try {
      metadata = await getAccessTokenMetadata();
    } catch (error) {
      console.warn("Não foi possível carregar o token atual da Kiwify", error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Fluxo de autenticação</h3>
        <p className="text-sm text-muted-foreground">
          A API da Kiwify utiliza OAuth 2.0 com grant type <code className="rounded bg-surface px-1">client_credentials</code>.
          Armazene o <code className="rounded bg-surface px-1">client_id</code> e o <code className="rounded bg-surface px-1">client_secret</code>
          nas variáveis do projeto. O painel gera o token automaticamente e permite renovar sob demanda.
        </p>
      </section>

      {ready ? (
        <TokenRefreshForm initialMetadata={metadata ?? undefined} />
      ) : (
        <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
          Configure <code className="rounded bg-surface px-1">KIWIFY_API_BASE_URL</code>,
          <code className="rounded bg-surface px-1">KIWIFY_CLIENT_ID</code>,
          <code className="rounded bg-surface px-1">KIWIFY_CLIENT_SECRET</code> e
          <code className="rounded bg-surface px-1">KIWIFY_ACCOUNT_ID</code> para habilitar o fluxo de autenticação.
        </div>
      )}

      <JsonPreview
        title="Credenciais ativas"
        data={{
          client_id: env?.KIWIFY_CLIENT_ID ? `${env.KIWIFY_CLIENT_ID.slice(0, 6)}…` : null,
          account_id: env?.KIWIFY_ACCOUNT_ID ?? null,
          scope: env?.KIWIFY_API_SCOPE ?? "padrão",
          audience: env?.KIWIFY_API_AUDIENCE ?? "padrão",
        }}
      />
    </div>
  );
}
