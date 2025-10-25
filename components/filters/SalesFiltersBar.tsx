"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useQueryReplace } from "@/hooks/useQueryReplace";
import { apiFetchJson } from "@/lib/apiFetch";

const statusOptions = [
  { label: "Aprovadas", value: "approved" },
  { label: "Pendentes", value: "pending" },
  { label: "Reembolsadas", value: "refunded" },
  { label: "Recusadas", value: "rejected" },
];

const paymentOptions = [
  { label: "PIX", value: "pix" },
  { label: "Cartão", value: "card" },
  { label: "Boleto", value: "boleto" },
];

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function parseList(value: string | null) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

export function SalesFiltersBar() {
  const searchParams = useSearchParams();
  const replaceQuery = useQueryReplace();
  const searchValue = searchParams.get("search") ?? "";
  const status = useMemo(() => parseList(searchParams.get("status")), [searchParams]);
  const payment = useMemo(() => parseList(searchParams.get("paymentMethod")), [searchParams]);
  const selectedProducts = useMemo(() => parseList(searchParams.get("productId")), [searchParams]);
  const [inputValue, setInputValue] = useState(searchValue);

  useEffect(() => {
    setInputValue(searchValue);
  }, [searchValue]);

  const { data: products = [] } = useQuery({
    queryKey: ["kfy", "products", "filters"],
    queryFn: async ({ signal }) => {
      const payload = await apiFetchJson<{ items: { id: number; title: string }[] }>(
        "/api/kfy/produtos?limit=50",
        { signal },
      );
      return payload.items.map((item) => ({ id: String(item.id), title: item.title ?? `Produto #${item.id}` }));
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar cliente ou pedido"
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
          onClick={() => {
            setInputValue("");
            replaceQuery({ search: null });
          }}
          className="rounded-full border border-surface-accent/60 px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          Limpar busca
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</span>
          {statusOptions.map((option) => {
            const active = status.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => replaceQuery({ status: toggleValue(status, option.value) })}
                className={`rounded-full px-4 py-1 text-xs transition ${active ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pagamento</span>
          {paymentOptions.map((option) => {
            const active = payment.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => replaceQuery({ paymentMethod: toggleValue(payment, option.value) })}
                className={`rounded-full px-4 py-1 text-xs transition ${active ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Produtos</span>
          <select
            multiple
            value={selectedProducts}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((option) => option.value);
              replaceQuery({ productId: values.length ? values : null });
            }}
            className="min-w-[220px] rounded-lg border border-surface-accent/60 bg-background px-3 py-2 text-sm text-white"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id} className="bg-background">
                {product.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
