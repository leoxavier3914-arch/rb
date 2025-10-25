"use client";

import { useMemo } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { useInfiniteResource } from "@/hooks/useInfiniteResource";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { apiFetch } from "@/lib/apiFetch";
import { TableState } from "@/components/tables/TableState";

interface RefundRow {
  id: number;
  externalId: string;
  status: string;
  amountCents: number;
  createdAt: string;
  processedAt: string | null;
  reason: string | null;
  customer: { name: string; email: string } | null;
  product: { title: string } | null;
  currency?: string;
}

export interface RefundFilters {
  from: string;
  to: string;
  status?: string[];
  search?: string;
}

async function fetchRefunds(filters: RefundFilters, cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.search) params.set("search", filters.search);
  if (cursor) params.set("cursor", cursor);

  const response = await apiFetch(`/api/kfy/reembolsos?${params.toString()}`, { signal });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Não foi possível carregar reembolsos");
  }

  return (await response.json()) as { items: RefundRow[]; nextCursor: string | null };
}

export function RefundsTable({ filters }: { filters: RefundFilters }) {
  const {
    items,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteResource<RefundRow>(
    [
      "refunds",
      filters.from,
      filters.to,
      filters.status?.join(",") ?? "",
      filters.search ?? "",
    ],
    ({ pageParam, signal }) => fetchRefunds(filters, pageParam ?? null, signal),
  );

  const columns = useMemo<ColumnDef<RefundRow>[]>(
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
              <span>{row.customer?.name ?? "Cliente"}</span>
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
        header: "Valor",
        accessorKey: "amountCents",
        cell: (context) => formatCurrency(context.getValue<number>(), context.row.original.currency ?? "BRL"),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: (context) => <span className="capitalize">{context.getValue<string>()}</span>,
      },
      {
        header: "Motivo",
        accessorKey: "reason",
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

  if (isError) {
    return (
      <TableState
        title="Não foi possível carregar reembolsos"
        description={(error as Error | undefined)?.message ?? "Tente novamente em instantes."}
        onAction={() => refetch()}
      />
    );
  }

  if (!items.length) {
    return isLoading ? (
      <TableState title="Carregando reembolsos…" />
    ) : (
      <TableState
        title="Nenhum reembolso encontrado"
        description="Ajuste os filtros e tente novamente."
        onAction={() => refetch()}
      />
    );
  }

  return (
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
      <div ref={sentinelRef} className="h-8" />
    </div>
  );
}
