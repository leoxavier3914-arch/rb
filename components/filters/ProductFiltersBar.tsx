"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { useQueryReplace } from "@/hooks/useQueryReplace";

const statusOptions = [
  { label: "Ativos", value: "approved" },
  { label: "Rascunhos", value: "pending" },
  { label: "Arquivados", value: "canceled" },
];

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function parseList(value: string | null) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

export function ProductFiltersBar() {
  const searchParams = useSearchParams();
  const replaceQuery = useQueryReplace();
  const status = useMemo(() => parseList(searchParams.get("status")), [searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4 text-xs text-muted-foreground">
      <span className="uppercase tracking-[0.2em]">Status</span>
      {statusOptions.map((option) => {
        const active = status.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => replaceQuery({ status: toggle(status, option.value) })}
            className={`rounded-full px-4 py-1 transition ${active ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
