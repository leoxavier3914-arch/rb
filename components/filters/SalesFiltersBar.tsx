"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useQueryReplace } from "@/hooks/useQueryReplace";

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

export function SalesFiltersBar() {
  const searchParams = useSearchParams();
  const replaceQuery = useQueryReplace();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const status = useMemo(() => searchParams.get("status")?.split(",").filter(Boolean) ?? [], [searchParams]);
  const payment = useMemo(() => searchParams.get("paymentMethod")?.split(",").filter(Boolean) ?? [], [searchParams]);
  const [products, setProducts] = useState<{ id: string; title: string }[]>([]);
  const selectedProducts = useMemo(
    () => searchParams.get("productId")?.split(",").filter(Boolean) ?? [],
    [searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const response = await fetch("/api/kfy/produtos?limit=50", {
          headers: { "x-admin-role": "true" },
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) {
          setProducts(
            (payload.items as { id: number; title: string }[]).map((item) => ({
              id: String(item.id),
              title: item.title,
            })),
          );
        }
      } catch (error) {
        console.error("Falha ao carregar produtos", error);
      }
    }
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar cliente ou pedido"
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
                onClick={() => replaceQuery({ status: toggleValue(status, option.value).join(",") || null })}
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
                onClick={() => replaceQuery({ paymentMethod: toggleValue(payment, option.value).join(",") || null })}
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
              replaceQuery({ productId: values.join(",") || null });
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
