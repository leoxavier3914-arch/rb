import { addDays, formatISO } from "date-fns";

import { DateRangeFilter } from "@/components/filters/DateRange";
import { ReportBuilder } from "@/components/reports/ReportBuilder";

function resolveRange(searchParams: Record<string, string | string[] | undefined>) {
  const from = typeof searchParams.from === "string" ? searchParams.from : formatISO(addDays(new Date(), -30), { representation: "date" });
  const to = typeof searchParams.to === "string" ? searchParams.to : formatISO(new Date(), { representation: "date" });
  return { from, to };
}

export default function RelatoriosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { from, to } = resolveRange(searchParams);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Relatórios</h1>
        <p className="text-sm text-muted-foreground">
          Combine dimensões e métricas para gerar análises personalizadas do desempenho comercial.
        </p>
      </header>
      <DateRangeFilter />
      <ReportBuilder from={from} to={to} />
    </div>
  );
}
