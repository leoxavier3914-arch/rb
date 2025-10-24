import { addDays, formatISO } from "date-fns";

import { DateRangeFilter } from "@/components/filters/DateRange";
import { SalesFiltersBar } from "@/components/filters/SalesFiltersBar";
import { SalesTable, type SalesTableFilters } from "@/components/tables/SalesTable";

function buildFilters(searchParams: Record<string, string | string[] | undefined>): SalesTableFilters {
  const from = typeof searchParams.from === "string" ? searchParams.from : formatISO(addDays(new Date(), -6), { representation: "date" });
  const to = typeof searchParams.to === "string" ? searchParams.to : formatISO(new Date(), { representation: "date" });

  return {
    from,
    to,
    status: typeof searchParams.status === "string" ? searchParams.status.split(",").filter(Boolean) : undefined,
    paymentMethod:
      typeof searchParams.paymentMethod === "string"
        ? searchParams.paymentMethod.split(",").filter(Boolean)
        : undefined,
    productId:
      typeof searchParams.productId === "string"
        ? searchParams.productId.split(",").filter(Boolean)
        : undefined,
    search: typeof searchParams.search === "string" ? searchParams.search : undefined,
  };
}

export default function VendasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = buildFilters(searchParams);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Explore todas as vendas com paginação infinita. Use filtros para refinar por status, método de pagamento e produtos.
        </p>
      </header>
      <section className="flex flex-col gap-4">
        <DateRangeFilter />
        <SalesFiltersBar />
      </section>
      <SalesTable filters={filters} />
    </div>
  );
}
