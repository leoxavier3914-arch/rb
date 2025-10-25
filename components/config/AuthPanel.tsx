"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { formatDateTime } from "@/lib/format";
import { apiFetch } from "@/lib/apiFetch";

type AuthSummary = {
  authenticated: boolean;
  expiresAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Token ativo",
  expired: "Token expirado",
  missing: "Sem token gerado",
};

function getStatusLabel(status: AuthSummary | null) {
  if (!status) {
    return "Carregando…";
  }

  if (!status.authenticated) {
    return STATUS_LABELS.missing;
  }

  if (!status.expiresAt) {
    return STATUS_LABELS.active;
  }

  const expiration = new Date(status.expiresAt).getTime();
  if (Number.isNaN(expiration)) {
    return STATUS_LABELS.active;
  }

  if (expiration <= Date.now()) {
    return STATUS_LABELS.expired;
  }

  return STATUS_LABELS.active;
}

const STATUS_QUERY_KEY = ["kfy-auth"] as const;

const extractPayload = async (response: Response) => {
  const payload = (await response.json()) as {
    ok: boolean;
    summary?: AuthSummary | null;
    error?: string;
    message?: string;
  };
  if (!payload.ok) {
    throw new Error(payload.error || payload.message || "Falha na requisição");
  }
  return payload.summary ?? { authenticated: false, expiresAt: null };
};

export function AuthPanel() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery<AuthSummary>({
    queryKey: STATUS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const response = await apiFetch("/api/kfy/auth", { method: "GET", signal });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao carregar status do token");
      }
      return extractPayload(response);
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/kfy/auth", { method: "POST" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao renovar token");
      }
      return extractPayload(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });

  const status = statusQuery.data ?? null;
  const errorMessage = (statusQuery.error as Error | undefined)?.message ?? (renewMutation.error as Error | undefined)?.message;

  const expiresLabel = useMemo(() => {
    if (!status?.expiresAt) {
      return "Indefinido";
    }

    try {
      return formatDateTime(status.expiresAt);
    } catch (error) {
      console.error("Erro ao formatar data de expiração do token", error);
      return status.expiresAt;
    }
  }, [status?.expiresAt]);

  const busy = statusQuery.isFetching || renewMutation.isPending;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-primary/60 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed"
          onClick={() => renewMutation.mutate()}
          disabled={busy}
        >
          Renovar token de acesso
        </button>
        <button
          type="button"
          className="rounded-full border border-primary/20 px-5 py-2 text-sm text-primary transition hover:border-primary hover:text-primary disabled:cursor-not-allowed"
          onClick={() => statusQuery.refetch()}
          disabled={busy}
        >
          Atualizar status
        </button>
        {busy && (
          <span className="text-xs text-muted-foreground">
            {renewMutation.isPending ? "Renovando token…" : "Atualizando…"}
          </span>
        )}
      </div>

      <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="uppercase tracking-wide text-xs">Status</dt>
          <dd className="text-white">{getStatusLabel(status)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="uppercase tracking-wide text-xs">Expira em</dt>
          <dd className="text-white">{expiresLabel}</dd>
        </div>
      </dl>

      {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
