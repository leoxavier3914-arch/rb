"use client";

import { useFormState } from "react-dom";

import { JsonPreview } from "@/components/json-preview";

import {
  refreshTokenAction,
  tokenActionInitialState,
  type TokenActionState,
} from "./actions";

function TokenFeedback({ state }: { state: TokenActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        state.ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/40 bg-red-500/10 text-red-300"
      }`}
    >
      {state.message}
    </div>
  );
}

export function TokenRefreshForm({ initialMetadata }: { initialMetadata: TokenActionState["metadata"] }) {
  const [state, formAction] = useFormState(refreshTokenAction, {
    ...tokenActionInitialState,
    metadata: initialMetadata,
  });

  const metadata = state.metadata ?? initialMetadata;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
      <div>
        <h3 className="text-lg font-semibold text-white">Token de acesso</h3>
        <p className="text-sm text-muted-foreground">
          A Kiwify utiliza OAuth2 com client credentials. Utilize o botão abaixo para renovar o token em caso de
          expiração ou erro de autorização.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <button
          type="submit"
          className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Renovar token agora
        </button>
      </form>
      <TokenFeedback state={state} />
      {metadata ? (
        <div className="grid gap-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Tipo</span>
            <span className="font-medium text-white">{metadata.tokenType}</span>
          </div>
          {metadata.scope ? (
            <div className="flex items-center justify-between gap-3">
              <span>Escopo</span>
              <span className="font-medium text-white">{metadata.scope}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span>Obtido em</span>
            <span className="font-medium text-white">
              {new Date(metadata.obtainedAt).toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Expira em</span>
            <span className="font-medium text-white">
              {new Date(metadata.expiresAt).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum token foi solicitado até o momento. Clique no botão acima para gerar um novo token de acesso.
        </p>
      )}
      {metadata ? (
        <JsonPreview
          data={{
            token_preview: metadata.preview,
            expires_at: metadata.expiresAt,
            obtained_at: metadata.obtainedAt,
            scope: metadata.scope,
          }}
          title="Metadados do token"
        />
      ) : null}
    </div>
  );
}
