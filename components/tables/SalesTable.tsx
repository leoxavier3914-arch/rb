"use client";

import { useMemo } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Papa from "papaparse";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { useInfiniteResource } from "@/hooks/useInfiniteResource";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { apiFetch } from "@/lib/apiFetch";
import { TableState } from "@/components/tables/TableState";

interface SaleRow {
  id: number;
  externalId: string;
  status: string;
  paymentMethod: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  commissionCents: number;
  currency: string;
  createdAt: string;
  approvedAt: string | null;
  customer: { name: string; email: string } | null;
  product: { title: string } | null;
}

export interface SalesTableFilters {
  from: string;
  to: string;
  status?: string[];
  paymentMethod?: string[];
  productId?: string[];
  search?: string;
}

async function fetchSales(filters: SalesTableFilters, cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.paymentMethod?.length) params.set("paymentMethod", filters.paymentMethod.join(","));
  if (filters.productId?.length) params.set("productId", filters.productId.join(","));
  if (filters.search) params.set("search", filters.search);
  if (cursor) params.set("cursor", cursor);

  const response = await apiFetch(`/api/kfy/vendas?${params.toString()}`, { signal });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Não foi possível carregar as vendas");
  }

  return (await response.json()) as { items: SaleRow[]; nextCursor: string | null };
}

export function SalesTable({ filters }: { filters: SalesTableFilters }) {
  const { items, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } =
    useInfiniteResource<SaleRow>([
      "sales",
      filters.from,
      filters.to,
      filters.status?.join(",") ?? "",
      filters.paymentMethod?.join(",") ?? "",
      filters.productId?.join(",") ?? "",
      filters.search ?? "",
    ], async ({ pageParam, signal }) => fetchSales(filters, pageParam ?? null, signal));

  const columns = useMemo<ColumnDef<SaleRow>[]>(
    () => [
      {
        header: "Data",
        accessorKey: "createdAt",
        cell: (context) => formatDateTime(context.getValue<string>()),
      },
      {
        header: "Pedido",
        accessorKey: "externalId",
      },
      {
        header: "Cliente",
        accessorFn: (row) => row.customer?.name ?? "-",
        cell: (context) => {
          const row = context.row.original;
          return (
            <div className="flex flex-col">
              <span>{row.customer?.name ?? "Cliente sem nome"}</span>
              <span className="text-xs text-muted-foreground">{row.customer?.email}</span>
            </div>
          );
        },
      },
      {
        header: "Produto",
        accessorFn: (row) => row.product?.title ?? "-",
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: (context) => <span className="capitalize">{context.getValue<string>()}</span>,
      },
      {
        header: "Método",
        accessorKey: "paymentMethod",
        cell: (context) => <span className="uppercase">{context.getValue<string>()}</span>,
      },
      {
        header: "Bruto",
        accessorKey: "grossCents",
        cell: (context) => formatCurrency(context.getValue<number>(), context.row.original.currency),
      },
      {
        header: "Taxas",
        accessorKey: "feeCents",
        cell: (context) => formatCurrency(context.getValue<number>(), context.row.original.currency),
      },
      {
        header: "Líquido",
        accessorKey: "netCents",
        cell: (context) => formatCurrency(context.getValue<number>(), context.row.original.currency),
      },
    ],
    [filters],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const sentinelRef = useIntersectionObserver(
    () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    undefined,
    hasNextPage,
  );

  function handleExportCsv() {
    const csv = Papa.unparse(
      items.map((item) => ({
        data: formatDateTime(item.createdAt),
        pedido: item.externalId,
        cliente: item.customer?.name ?? "",
        email: item.customer?.email ?? "",
        produto: item.product?.title ?? "",
        status: item.status,
        metodo: item.paymentMethod,
        bruto: formatCurrency(item.grossCents, item.currency),
        taxas: formatCurrency(item.feeCents, item.currency),
        liquido: formatCurrency(item.netCents, item.currency),
      })),
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `vendas-${filters.from}-${filters.to}.csv`);
    link.click();
  }

  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-full border border-primary/50 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          Exportar CSV
        </button>
      </div>
      {isError ? (
        <TableState
          title="Não foi possível carregar as vendas"
          description={(error as Error | undefined)?.message ?? "Tente novamente em instantes."}
          onAction={() => refetch()}
        />
      ) : hasItems ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-accent/40 text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-surface-accent/20">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-accent/40">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div ref={sentinelRef} className="h-8" />
        </>
      ) : isLoading ? (
        <TableState title="Carregando vendas…" />
      ) : (
        <TableState title="Nenhuma venda encontrada" description="Ajuste os filtros e tente novamente." onAction={() => refetch()} />
      )}
    </div>
  );
}
