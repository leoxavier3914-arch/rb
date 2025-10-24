"use client";

import { useMemo } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { useInfiniteResource } from "@/hooks/useInfiniteResource";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

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

async function fetchRefunds(filters: RefundFilters, cursor?: string | null) {
  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.search) params.set("search", filters.search);
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/kfy/reembolsos?${params.toString()}`, {
    headers: { "x-admin-role": "true" },
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar reembolsos");
  }

  return response.json();
}

export function RefundsTable({ filters }: { filters: RefundFilters }) {
  const { items, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteResource<RefundRow>(
    ["refunds", filters],
    ({ pageParam }) => fetchRefunds(filters, pageParam ?? undefined),
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

  const sentinelRef = useIntersectionObserver(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-surface-accent/40 text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
