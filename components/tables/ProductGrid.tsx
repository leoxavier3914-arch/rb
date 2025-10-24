"use client";

import { formatCurrency } from "@/lib/format";
import { useInfiniteResource } from "@/hooks/useInfiniteResource";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface ProductRow {
  id: number;
  externalId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  status: string;
  metrics: { orders: number; grossCents: number };
}

export interface ProductFilters {
  status?: string[];
}

async function fetchProducts(filters: ProductFilters, cursor?: string | null) {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/kfy/produtos?${params.toString()}`, {
    headers: { "x-admin-role": "true" },
  });
  if (!response.ok) {
    throw new Error("Não foi possível carregar produtos");
  }
  return response.json();
}

const mutationsEnabled = process.env.NEXT_PUBLIC_KIWIFY_ALLOW_PRODUCT_MUTATIONS === "true";

export function ProductGrid({ filters }: { filters: ProductFilters }) {
  const { items, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteResource<ProductRow>(
    ["products", filters],
    ({ pageParam }) => fetchProducts(filters, pageParam ?? undefined),
  );

  const sentinelRef = useIntersectionObserver(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((product) => (
          <article key={product.id} className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface/90 p-5 shadow-soft">
            <div className="flex items-start gap-4">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.title} className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-accent/40 text-muted-foreground">
                  sem imagem
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">{product.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-3 text-sm text-muted-foreground">
              <span className="rounded-full bg-surface-accent/40 px-3 py-1 capitalize">{product.status}</span>
              <span>{formatCurrency(product.priceCents, product.currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{product.metrics.orders} vendas</span>
              <span>{formatCurrency(product.metrics.grossCents, product.currency)}</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!mutationsEnabled}
                title={mutationsEnabled ? "Editar produto" : "Não disponível na API"}
                className="flex-1 rounded-full border border-primary/40 px-4 py-2 text-sm text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted-foreground"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={!mutationsEnabled}
                title={mutationsEnabled ? "Remover produto" : "Não disponível na API"}
                className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted-foreground"
              >
                Remover
              </button>
            </div>
          </article>
        ))}
      </div>
      <div ref={sentinelRef} className="h-8" />
      {!mutationsEnabled ? (
        <p className="text-center text-sm text-muted-foreground">
          A API da Kiwify ainda não oferece criação/edição de produtos. Ações desabilitadas intencionalmente.
        </p>
      ) : null}
    </div>
  );
}
