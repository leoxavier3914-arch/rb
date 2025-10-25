"use client";

import { useMemo } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { formatDateTime } from "@/lib/format";
import { useInfiniteResource } from "@/hooks/useInfiniteResource";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { apiFetch } from "@/lib/apiFetch";
import { TableState } from "@/components/tables/TableState";

interface EnrollmentRow {
  id: number;
  externalId: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: { title: string } | null;
  customer: { name: string; email: string } | null;
}

export interface EnrollmentFilters {
  status?: string[];
  customerId?: string;
}

async function fetchEnrollments(filters: EnrollmentFilters, cursor: string | null, signal: AbortSignal) {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (cursor) params.set("cursor", cursor);

  const response = await apiFetch(`/api/kfy/alunas?${params.toString()}`, { signal });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Não foi possível carregar matrículas");
  }

  return (await response.json()) as { items: EnrollmentRow[]; nextCursor: string | null };
}

export function EnrollmentsTable({ filters }: { filters: EnrollmentFilters }) {
  const {
    items,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteResource<EnrollmentRow>(
    [
      "enrollments",
      filters.status?.join(",") ?? "",
      filters.customerId ?? "",
    ],
    ({ pageParam, signal }) => fetchEnrollments(filters, pageParam ?? null, signal),
  );

  const columns = useMemo<ColumnDef<EnrollmentRow>[]>(
    () => [
      {
        header: "Aluna",
        accessorFn: (row) => row.customer?.name ?? "-",
        cell: (context) => {
          const row = context.row.original;
          return (
            <div className="flex flex-col">
              <span>{row.customer?.name ?? "Cliente"}</span>
              <span className="text-xs text-muted-foreground">{row.customer?.email ?? "não disponível na API"}</span>
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
        header: "Início",
        accessorKey: "startedAt",
        cell: (context) => {
          const value = context.getValue<string | null>();
          return value ? formatDateTime(value) : "não disponível";
        },
      },
      {
        header: "Expira",
        accessorKey: "expiresAt",
        cell: (context) => {
          const value = context.getValue<string | null>();
          return value ? formatDateTime(value) : "não disponível";
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
        title="Não foi possível carregar matrículas"
        description={(error as Error | undefined)?.message ?? "Tente novamente em instantes."}
        onAction={() => refetch()}
      />
    );
  }

  if (!items.length) {
    return isLoading ? (
      <TableState title="Carregando matrículas…" />
    ) : (
      <TableState
        title="Nenhuma matrícula encontrada"
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
