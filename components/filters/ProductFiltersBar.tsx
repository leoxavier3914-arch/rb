"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

const statusOptions = [
  { label: "Ativos", value: "approved" },
  { label: "Rascunhos", value: "pending" },
  { label: "Arquivados", value: "canceled" },
];

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ProductFiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = useMemo(() => searchParams.get("status")?.split(",").filter(Boolean) ?? [], [searchParams]);

  function sync(values: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length) {
      params.set("status", values.join(","));
    } else {
      params.delete("status");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4 text-xs text-muted-foreground">
      <span className="uppercase tracking-[0.2em]">Status</span>
      {statusOptions.map((option) => {
        const active = status.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => sync(toggle(status, option.value))}
            className={`rounded-full px-4 py-1 transition ${active ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
