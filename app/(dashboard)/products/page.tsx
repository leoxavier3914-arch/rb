import clsx from "clsx";

import { formatCurrency, formatDate } from "@/lib/format";
import {
  getKiwifyProducts,
  hasKiwifyApiConfig,
  type KiwifyProductSummary,
} from "@/lib/kiwify-api";

export const dynamic = "force-dynamic";

const formatPrice = (product: KiwifyProductSummary) => {
  if (product.price === null) {
    return "Preço não informado";
  }

  const formatted = formatCurrency(product.price, product.currency);
  return formatted ?? "Preço não informado";
};

export default async function ProductsPage() {
  const hasApiConfig = hasKiwifyApiConfig();
  const result = hasApiConfig ? await getKiwifyProducts() : null;
  const products = result?.products ?? [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Produtos</span>
        <h2 className="text-2xl font-semibold text-primary-foreground sm:text-3xl">
          Catálogo oficial sincronizado com a Kiwify
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Carregamos nome, status, preços e metadados direto da API de produtos para enriquecer as telas do hub e
          habilitar ações rápidas de monitoramento.
        </p>
      </header>

      {!hasApiConfig ? (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-surface/60 p-6 text-sm text-muted-foreground">
          Configure <code className="rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_CLIENT_ID</code>,
          <code className="ml-1 rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_CLIENT_SECRET</code> e
          <code className="ml-1 rounded bg-black/20 px-1 py-0.5 text-xs">KIWIFY_API_ACCOUNT_ID</code> para sincronizar o catálogo oficial.
        </div>
      ) : (
        <>
          {result?.error ? (
            <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              {result.error}
            </p>
          ) : null}

          {products.length === 0 ? (
            <p className="rounded-2xl border border-surface-accent/40 bg-surface/70 p-6 text-sm text-muted-foreground">
              Ainda não encontramos produtos publicados pela API da Kiwify. Assim que o catálogo estiver disponível ele
              aparecerá automaticamente aqui.
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const statusLabel = product.status ?? (product.isPublished ? "Publicado" : "Rascunho");
                const updatedAt = formatDate(product.updatedAt);

                return (
                  <article
                    key={product.id ?? product.name ?? Math.random().toString(36).slice(2)}
                    className="flex flex-col overflow-hidden rounded-3xl border border-surface-accent/40 bg-surface/80 shadow-soft"
                  >
                    <div className="h-44 w-full bg-surface-accent/40">
                      {product.imageUrl ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${product.imageUrl})` }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                          Sem imagem cadastrada
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-4 p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-lg font-semibold text-primary-foreground">
                            {product.name ?? "Produto sem nome"}
                          </h3>
                          <p className="text-sm text-muted-foreground">{formatPrice(product)}</p>
                        </div>
                        <span
                          className={clsx(
                            "rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]",
                            product.isPublished
                              ? "bg-green-500/20 text-green-200"
                              : "bg-yellow-500/20 text-yellow-100",
                          )}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {product.description ? (
                        <p className="line-clamp-3 text-sm text-muted-foreground">{product.description}</p>
                      ) : null}

                      {product.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {product.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-surface-accent/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <dl className="mt-auto grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                        {product.totalSales !== null ? (
                          <div className="flex flex-col gap-1">
                            <dt className="uppercase tracking-[0.2em]">Vendas</dt>
                            <dd className="font-semibold text-primary-foreground">
                              {product.totalSales.toLocaleString("pt-BR")}
                            </dd>
                          </div>
                        ) : null}
                        {product.averageTicket !== null ? (
                          <div className="flex flex-col gap-1">
                            <dt className="uppercase tracking-[0.2em]">Ticket médio</dt>
                            <dd className="font-semibold text-primary-foreground">
                              {formatCurrency(product.averageTicket, product.currency) ?? "—"}
                            </dd>
                          </div>
                        ) : null}
                        {updatedAt ? (
                          <div className="col-span-2 flex flex-col gap-1">
                            <dt className="uppercase tracking-[0.2em]">Atualizado em</dt>
                            <dd className="font-semibold text-primary-foreground">{updatedAt}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
