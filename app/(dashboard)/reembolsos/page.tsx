import { addDays, formatISO } from "date-fns";

import { DateRangeFilter } from "@/components/filters/DateRange";
import { RefundFiltersBar } from "@/components/filters/RefundFiltersBar";
import { RefundsTable, type RefundFilters } from "@/components/tables/RefundsTable";

function buildFilters(searchParams: Record<string, string | string[] | undefined>): RefundFilters {
  const from = typeof searchParams.from === "string" ? searchParams.from : formatISO(addDays(new Date(), -6), { representation: "date" });
  const to = typeof searchParams.to === "string" ? searchParams.to : formatISO(new Date(), { representation: "date" });
  return {
    from,
    to,
    status: typeof searchParams.status === "string" ? searchParams.status.split(",").filter(Boolean) : undefined,
    search: typeof searchParams.search === "string" ? searchParams.search : undefined,
  };
}

export default function ReembolsosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = buildFilters(searchParams);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Reembolsos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe solicitações de reembolso, motivos e status de processamento.
        </p>
      </header>
      <section className="flex flex-col gap-4">
        <DateRangeFilter />
        <RefundFiltersBar />
      </section>
      <RefundsTable filters={filters} />
    </div>
  );
}
