"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/apiFetch";

type SyncCursor = {
  resource?: "products" | "sales";
  page?: number;
  intervalIndex?: number;
  done?: boolean;
} | null;

type SyncStats = Record<string, number>;

const INITIAL_STATS: SyncStats = {
  pagesFetched: 0,
  productsUpserted: 0,
  salesUpserted: 0,
  batches: 0,
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

async function postSync(endpoint: string, body: Record<string, unknown>) {
  const response = await apiFetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Falha na sincronização");
  }

  return (await response.json()) as {
    ok: boolean;
    done: boolean;
    nextCursor: SyncCursor;
    stats: SyncStats;
    logs?: Array<{ url: string; page: number; status: number; elapsedMs: number }>;
  };
}

async function fetchSyncState() {
  try {
    const response = await apiFetch("/api/kfy/sync", { method: "GET" });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      state?: { cursor?: SyncCursor; lastRunAt?: string | null; lastStats?: SyncStats | null } | null;
    };
    return payload.state ?? null;
  } catch (error) {
    console.warn("Falha ao carregar estado do sync", error);
    return null;
  }
}

export function SyncPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [stats, setStats] = useState<SyncStats>(INITIAL_STATS);

  useEffect(() => {
    void (async () => {
      const state = await fetchSyncState();
      if (state?.lastRunAt) {
        setLastRunAt(state.lastRunAt);
      }
      if (state?.lastStats) {
        setStats({ ...INITIAL_STATS, ...state.lastStats });
      }
    })();
  }, []);

  const progressSummary = useMemo(
    () => [
      { label: "Páginas", value: stats.pagesFetched ?? 0 },
      { label: "Produtos", value: stats.productsUpserted ?? 0 },
      { label: "Vendas", value: stats.salesUpserted ?? 0 },
      { label: "Lotes", value: stats.batches ?? 0 },
    ],
    [stats],
  );

  async function runSyncFlow(endpoint: string, baseBody: Record<string, unknown>) {
    setLoading(true);
    setStatus(null);
    setStats(INITIAL_STATS);

    try {
      let cursor: SyncCursor = baseBody.cursor ?? null;
      let done = false;

      while (!done) {
        const result = await postSync(endpoint, {
          ...baseBody,
          cursor,
          persist: true,
        });

        if (!result.ok) {
          throw new Error("Falha durante a sincronização");
        }

        setStats(prev => ({
          ...prev,
          ...result.stats,
        }));

        done = result.done;
        cursor = result.nextCursor;

        if (done) {
          break;
        }
      }

      const state = await fetchSyncState();
      if (state?.lastRunAt) {
        setLastRunAt(state.lastRunAt);
      }
      if (state?.lastStats) {
        setStats({ ...INITIAL_STATS, ...state.lastStats });
      }
      setStatus("Sincronização concluída");
    } catch (error) {
      console.error(error);
      setStatus("Falha ao executar sincronização");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => runSyncFlow("/api/kfy/sync", { full: true })}
          className="rounded-full border border-primary/60 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed"
        >
          Rodar sync completo
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => runSyncFlow("/api/kfy/reconcile", {})}
          className="rounded-full border border-primary/20 px-5 py-2 text-sm text-primary transition hover:border-primary hover:text-primary disabled:cursor-not-allowed"
        >
          Sync incremental
        </button>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {progressSummary.map(item => (
          <span key={item.label} className="rounded-full border border-surface-accent/40 px-3 py-1">
            {item.label}: <span className="text-white">{item.value}</span>
          </span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Última atualização: {formatDateTime(lastRunAt)}</p>

      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
