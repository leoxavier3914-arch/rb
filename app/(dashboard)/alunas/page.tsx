import { EnrollmentFiltersBar } from "@/components/filters/EnrollmentFiltersBar";
import { EnrollmentsTable, type EnrollmentFilters } from "@/components/tables/EnrollmentsTable";

function buildFilters(searchParams: Record<string, string | string[] | undefined>): EnrollmentFilters {
  return {
    status: typeof searchParams.status === "string" ? searchParams.status.split(",").filter(Boolean) : undefined,
  };
}

export default function AlunasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = buildFilters(searchParams);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-white">Alunas</h1>
        <p className="text-sm text-muted-foreground">
          Veja quem está matriculado nos cursos, status de acesso e datas de expiração.
        </p>
      </header>
      <EnrollmentFiltersBar />
      <EnrollmentsTable filters={filters} />
    </div>
  );
}
