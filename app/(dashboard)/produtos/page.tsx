import { ProductFiltersBar } from "@/components/filters/ProductFiltersBar";
import { ProductGrid, type ProductFilters } from "@/components/tables/ProductGrid";

function buildFilters(searchParams: Record<string, string | string[] | undefined>): ProductFilters {
  return {
    status: typeof searchParams.status === "string" ? searchParams.status.split(",").filter(Boolean) : undefined,
  };
}

const mutationsEnabled = process.env.NEXT_PUBLIC_KIWIFY_ALLOW_PRODUCT_MUTATIONS === "true";

export default function ProdutosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = buildFilters(searchParams);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Catálogo completo sincronizado com a Kiwify. Visualize preços, status e vendas totais.
            </p>
          </div>
          <button
            type="button"
            disabled={!mutationsEnabled}
            title={mutationsEnabled ? "Adicionar produto" : "Não disponível na API"}
            className="rounded-full border border-primary/60 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted-foreground"
          >
            Novo produto
          </button>
        </div>
      </header>
      <ProductFiltersBar />
      <ProductGrid filters={filters} />
    </div>
  );
}
