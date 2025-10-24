"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Papa from "papaparse";

const dimensionOptions = [
  { label: "Dia", value: "day" },
  { label: "Produto", value: "product" },
  { label: "Método", value: "method" },
  { label: "Status", value: "status" },
];

const metricOptions = [
  { label: "Bruto", value: "gross" },
  { label: "Líquido", value: "net" },
  { label: "Comissão", value: "commission" },
  { label: "Pedidos", value: "orders" },
];

type ReportRow = Record<string, string | number>;

export function ReportBuilder({ from, to }: { from: string; to: string }) {
  const [dimensions, setDimensions] = useState<string[]>(["day"]);
  const [metrics, setMetrics] = useState<string[]>(["gross", "orders"]);

  const query = useQuery({
    queryKey: ["reports", { from, to, dimensions, metrics }],
    queryFn: async () => {
      const params = new URLSearchParams({
        from,
        to,
        dimensions: dimensions.join(","),
        metrics: metrics.join(","),
      });
      const response = await fetch(`/api/kfy/relatorios?${params.toString()}`, {
        headers: { "x-admin-role": "true" },
      });
      if (!response.ok) {
        throw new Error("Não foi possível gerar relatório");
      }
      return (await response.json()) as { items: ReportRow[] };
    },
  });

  const data = query.data?.items ?? [];

  const columns = useMemo(() => {
    const uniqueKeys = new Set<string>();
    data.forEach((row) => {
      Object.keys(row).forEach((key) => uniqueKeys.add(key));
    });
    return Array.from(uniqueKeys);
  }, [data]);

  function toggle(value: string, current: string[], setter: (value: string[]) => void) {
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setter(next);
  }

  function handleExport() {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `relatorio-${from}-${to}.csv`);
    link.click();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Dimensões</h3>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {dimensionOptions.map((option) => {
              const active = dimensions.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value, dimensions, setDimensions)}
                  className={`rounded-full px-4 py-1 transition ${active ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-surface-accent/40 bg-surface/80 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Métricas</h3>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {metricOptions.map((option) => {
              const active = metrics.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value, metrics, setMetrics)}
                  className={`rounded-full px-4 py-1 transition ${active ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-full border border-primary/60 px-5 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-surface-accent/40 text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-accent/20">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-surface-accent/40">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-2">
                    {row[column] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
