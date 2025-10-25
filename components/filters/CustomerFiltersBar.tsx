"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useQueryReplace } from "@/hooks/useQueryReplace";

export function CustomerFiltersBar() {
  const searchParams = useSearchParams();
  const replaceQuery = useQueryReplace();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const activeOnly = useMemo(() => searchParams.get("active") === "true", [searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <input
        type="search"
        placeholder="Buscar cliente"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onBlur={() => replaceQuery({ search: search.trim() || null })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            replaceQuery({ search: search.trim() || null });
          }
        }}
        className="flex-1 rounded-full border border-surface-accent/60 bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={() => replaceQuery({ active: activeOnly ? null : "true" })}
        className={`rounded-full px-4 py-2 text-xs transition ${activeOnly ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
      >
        Clientes ativos
      </button>
    </div>
  );
}
