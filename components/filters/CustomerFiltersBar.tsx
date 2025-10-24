"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export function CustomerFiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const activeOnly = useMemo(() => searchParams.get("active") === "true", [searchParams]);

  function sync(partial: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(partial).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <input
        type="search"
        placeholder="Buscar cliente"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onBlur={() => sync({ search: search.trim() || null })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            sync({ search: search.trim() || null });
          }
        }}
        className="flex-1 rounded-full border border-surface-accent/60 bg-background px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={() => sync({ active: activeOnly ? null : "true" })}
        className={`rounded-full px-4 py-2 text-xs transition ${activeOnly ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
      >
        Clientes ativos
      </button>
    </div>
  );
}
