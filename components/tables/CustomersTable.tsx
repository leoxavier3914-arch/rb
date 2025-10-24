"use client";

import { useMemo } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { formatCurrency, formatDateTime } from "@/lib/format";
import { useInfiniteResource } from "@/hooks/useInfiniteResource";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface CustomerRow {
  id: number;
  externalId: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
  metrics: {
    orders: number;
    totalNetCents: number;
    lastPurchase: string | null;
  };
}

export interface CustomerFilters {
  from: string;
  to: string;
  search?: string;
  activeOnly?: boolean;
}

async function fetchCustomers(filters: CustomerFilters, cursor?: string | null) {
  const params = new URLSearchParams();
  params.set("from", filters.from);
  params.set("to", filters.to);
  if (filters.search) params.set("search", filters.search);
  if (filters.activeOnly) params.set("active", "true");
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/kfy/clientes?${params.toString()}`, {
    headers: { "x-admin-role": "true" },
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar clientes");
  }

  return response.json();
}

export function CustomersTable({ filters }: { filters: CustomerFilters }) {
  const { items, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteResource<CustomerRow>(
    ["customers", filters],
    ({ pageParam }) => fetchCustomers(filters, pageParam ?? undefined),
  );

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        header: "Cliente",
        accessorKey: "name",
        cell: (context) => {
          const row = context.row.original;
          return (
            <div className="flex flex-col">
              <span>{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.email}</span>
            </div>
          );
        },
      },
      {
        header: "Pedidos",
        accessorFn: (row) => row.metrics.orders,
      },
      {
        header: "Total gasto",
        accessorFn: (row) => row.metrics.totalNetCents,
        cell: (context) => {
          const row = context.row.original;
          return formatCurrency(row.metrics.totalNetCents, "BRL");
        },
      },
      {
        header: "Última compra",
        accessorFn: (row) => row.metrics.lastPurchase,
        cell: (context) => {
          const value = context.getValue<string | null>();
          return value ? formatDateTime(value) : "-";
        },
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
