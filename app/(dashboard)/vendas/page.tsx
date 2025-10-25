import { addDays, formatISO } from "date-fns";

import { DateRangeFilter } from "@/components/filters/DateRange";
import { SalesFiltersBar } from "@/components/filters/SalesFiltersBar";
import { SalesTable, type SalesTableFilters } from "@/components/tables/SalesTable";

const DEFAULT_RANGE = {
  from: formatISO(addDays(new Date(), -6), { representation: "date" }),
  to: formatISO(new Date(), { representation: "date" }),
};

const splitParam = (value: string | string[] | undefined) => {
  if (!value) {
    return [] as string[];
  }
  const normalized = Array.isArray(value) ? value : [value];
  return normalized
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

function buildFilters(searchParams: Record<string, string | string[] | undefined>): SalesTableFilters {
  const fromParam = typeof searchParams.from === "string" ? searchParams.from.trim() : "";
  const toParam = typeof searchParams.to === "string" ? searchParams.to.trim() : "";

  const from = fromParam || DEFAULT_RANGE.from;
  const to = toParam || DEFAULT_RANGE.to;

  const status = splitParam(searchParams.status);
  const paymentMethod = splitParam(searchParams.paymentMethod);
  const productId = splitParam(searchParams.productId);
  const search = typeof searchParams.search === "string" ? searchParams.search.trim() : undefined;

  return {
    from,
    to,
    status: status.length ? status : undefined,
    paymentMethod: paymentMethod.length ? paymentMethod : undefined,
    productId: productId.length ? productId : undefined,
    search: search ? search : undefined,
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
