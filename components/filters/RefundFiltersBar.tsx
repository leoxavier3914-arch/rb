"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useQueryReplace } from "@/hooks/useQueryReplace";

const statusOptions = [
  { label: "Processados", value: "approved" },
  { label: "Em análise", value: "pending" },
  { label: "Concluídos", value: "refunded" },
];

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function RefundFiltersBar() {
  const searchParams = useSearchParams();
  const replaceQuery = useQueryReplace();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const status = useMemo(() => searchParams.get("status")?.split(",").filter(Boolean) ?? [], [searchParams]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar reembolso"
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
          onClick={() => {
            setSearch("");
            replaceQuery({ search: null });
          }}
          className="rounded-full border border-surface-accent/60 px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          Limpar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</span>
        {statusOptions.map((option) => {
          const active = status.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => replaceQuery({ status: toggleValue(status, option.value).join(",") || null })}
              className={`rounded-full px-4 py-1 text-xs transition ${active ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
