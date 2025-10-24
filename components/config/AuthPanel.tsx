"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDateTime } from "@/lib/format";

type AuthStatus = {
  authenticated: boolean;
  expiresAt: string | null;
};

const ADMIN_HEADERS = {
  "x-admin-role": "true",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Token ativo",
  expired: "Token expirado",
  missing: "Sem token gerado",
};

function getStatusLabel(status: AuthStatus | null) {
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

export function AuthPanel() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kfy/auth", {
        method: "GET",
        headers: ADMIN_HEADERS,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao carregar status do token");
      }

      const payload = (await response.json()) as AuthStatus;
      setStatus(payload);
    } catch (error) {
      console.error(error);
      setError("Não foi possível verificar o token de acesso.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshToken = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/kfy/auth", {
        method: "POST",
        headers: ADMIN_HEADERS,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao renovar token");
      }

      const payload = (await response.json()) as { expiresAt: string | null };
      setStatus({
        authenticated: true,
        expiresAt: payload.expiresAt,
      });
    } catch (error) {
      console.error(error);
      setError("Não foi possível renovar o token de acesso.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const busy = loading || refreshing;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-primary/60 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed"
          onClick={refreshToken}
          disabled={busy}
        >
          Renovar token de acesso
        </button>
        <button
          type="button"
          className="rounded-full border border-primary/20 px-5 py-2 text-sm text-primary transition hover:border-primary hover:text-primary disabled:cursor-not-allowed"
          onClick={fetchStatus}
          disabled={busy}
        >
          Atualizar status
        </button>
        {(loading || refreshing) && (
          <span className="text-xs text-muted-foreground">{refreshing ? "Renovando token…" : "Atualizando…"}</span>
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

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
