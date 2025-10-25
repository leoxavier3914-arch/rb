"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useQueryReplace } from "@/hooks/useQueryReplace";

export function CustomerFiltersBar() {
  const searchParams = useSearchParams();
  const replaceQuery = useQueryReplace();

  const searchValue = searchParams.get("search") ?? "";
  const [inputValue, setInputValue] = useState(searchValue);
  const activeOnly = useMemo(() => searchParams.get("active") === "true", [searchParams]);

  useEffect(() => {
    setInputValue(searchValue);
  }, [searchValue]);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <input
        type="search"
        placeholder="Buscar cliente"
        value={inputValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          replaceQuery({ search: nextValue || null }, { throttleMs: 200 });
        }}
        onBlur={() => replaceQuery({ search: inputValue || null })}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            replaceQuery({ search: inputValue || null });
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
