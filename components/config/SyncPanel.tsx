"use client";

import { useState } from "react";

export function SyncPanel() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function triggerSync(full: boolean) {
    setLoading(true);
    setStatus(null);
    try {
      const params = full ? "?full=true" : "";
      const response = await fetch(`/api/kfy/sync${params}`, {
        method: "POST",
        headers: { "x-admin-role": "true" },
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message);
      }
      const payload = await response.json();
      setStatus(`Sincronização concluída: ${JSON.stringify(payload.summary)}`);
    } catch (error) {
      console.error(error);
      setStatus("Falha ao executar sincronização");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => triggerSync(true)}
          className="rounded-full border border-primary/60 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed"
        >
          Rodar sync completo
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => triggerSync(false)}
          className="rounded-full border border-primary/20 px-5 py-2 text-sm text-primary transition hover:border-primary hover:text-primary disabled:cursor-not-allowed"
        >
          Sync incremental
        </button>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
