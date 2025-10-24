import { addDays, formatISO } from "date-fns";

import { CustomerFiltersBar } from "@/components/filters/CustomerFiltersBar";
import { DateRangeFilter } from "@/components/filters/DateRange";
import { CustomersTable, type CustomerFilters } from "@/components/tables/CustomersTable";

function buildFilters(searchParams: Record<string, string | string[] | undefined>): CustomerFilters {
  const from = typeof searchParams.from === "string" ? searchParams.from : formatISO(addDays(new Date(), -30), { representation: "date" });
  const to = typeof searchParams.to === "string" ? searchParams.to : formatISO(new Date(), { representation: "date" });
  return {
    from,
    to,
    search: typeof searchParams.search === "string" ? searchParams.search : undefined,
    activeOnly: searchParams.active === "true",
  };
}

export default function ClientesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = buildFilters(searchParams);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Visualize o histórico de compras, ticket médio e clientes ativos no período selecionado.
        </p>
      </header>
      <section className="flex flex-col gap-4">
        <DateRangeFilter />
        <CustomerFiltersBar />
      </section>
      <CustomersTable filters={filters} />
    </div>
  );
}
