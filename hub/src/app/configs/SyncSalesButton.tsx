"use client";

import { useCallback, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { syncSalesAction } from "./_actions/sync-sales";

interface SyncState {
  readonly status: "idle" | "loading" | "success" | "error";
  readonly message?: string;
}

export function SyncSalesButton() {
  const [state, setState] = useState<SyncState>({ status: "idle" });

  const handleSync = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const result = await syncSalesAction();
      const message = `Sincronização concluída. ${result.imported} vendas processadas.`;
      setState({ status: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao sincronizar.";
      setState({ status: "error", message });
    }
  }, []);

  return (
    <div className="space-y-3">
      <Button onClick={handleSync} disabled={state.status === "loading"} className="gap-2">
        {state.status === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {state.status === "loading" ? "Sincronizando..." : "Sincronizar vendas"}
      </Button>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-sm font-medium text-rose-600"
              : "text-sm font-medium text-emerald-600"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
