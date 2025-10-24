"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import { formatDate } from "@/lib/format";

import type { NormalizedSale } from "./page";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "paid", label: "Pagas" },
  { value: "pending", label: "Pendentes" },
  { value: "refused", label: "Recusadas" },
  { value: "refunded", label: "Reembolsadas" },
  { value: "chargeback", label: "Chargeback" },
];

const STATUS_VARIANTS: Record<string, string> = {
  paid: "border-emerald-400/40 bg-emerald-500/20 text-emerald-200",
  pending: "border-amber-400/40 bg-amber-500/20 text-amber-200",
  refused: "border-rose-400/40 bg-rose-500/20 text-rose-200",
  refunded: "border-sky-400/40 bg-sky-500/20 text-sky-200",
  chargeback: "border-purple-400/40 bg-purple-500/20 text-purple-200",
  default: "border-surface-accent/40 bg-surface-accent/40 text-muted-foreground",
};

const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const matchesStatus = (sale: NormalizedSale, selected: string) => {
  if (!selected || selected === "all") {
    return true;
  }

  const status = normalize(sale.status);
  if (!status) {
    return false;
  }

  if (selected === "paid") {
    return (
      status.includes("paid") ||
      status.includes("approved") ||
      status.includes("confirm")
    );
  }

  if (selected === "pending") {
    return (
      status.includes("pending") ||
      status.includes("wait") ||
      status.includes("aguard")
    );
  }

  if (selected === "refused") {
    return (
      status.includes("refus") ||
      status.includes("rejected") ||
      status.includes("failed") ||
      status.includes("cancel")
    );
  }

  if (selected === "refunded") {
    return status.includes("refund");
  }

  if (selected === "chargeback") {
    return status.includes("charge") || status.includes("contest");
  }

  return true;
};

const resolveStatusVariant = (status: string | null | undefined) => {
  const normalized = normalize(status);
  if (!normalized) return STATUS_VARIANTS.default;
  if (normalized.includes("refund")) return STATUS_VARIANTS.refunded;
  if (normalized.includes("charge")) return STATUS_VARIANTS.chargeback;
  if (normalized.includes("pend")) return STATUS_VARIANTS.pending;
  if (normalized.includes("refus") || normalized.includes("rejei") || normalized.includes("fail")) {
    return STATUS_VARIANTS.refused;
  }
  if (normalized.includes("paid") || normalized.includes("aprov") || normalized.includes("confirm")) {
    return STATUS_VARIANTS.paid;
  }
  return STATUS_VARIANTS.default;
};

const useSyncedState = (value: string) => {
  const [state, setState] = useState(value);
  useEffect(() => {
    setState(value);
  }, [value]);
  return [state, setState] as const;
};

interface SalesTableProps {
  sales: NormalizedSale[];
  initialStatus: string;
  initialQuery: string;
  initialStartDate: string | null;
  initialEndDate: string | null;
  initialPage: number;
}

const allowedParams = new Set(["status", "q", "start_date", "end_date", "page"]);

const buildDetailHref = (
  saleId: string,
  currentParams: URLSearchParams,
): string => {
  const persisted = new URLSearchParams();
  for (const key of allowedParams) {
    const value = currentParams.get(key);
    if (value) {
      persisted.set(key, value);
    }
  }
  const qs = persisted.toString();
  return qs
    ? `/sales/${encodeURIComponent(saleId)}?${qs}`
    : `/sales/${encodeURIComponent(saleId)}`;
};

const formatDateDisplay = (value: string | null | undefined) => {
  if (!value) return "—";
  return formatDate(value) ?? value;
};

export default function SalesTable({
  sales,
  initialStatus,
  initialQuery,
  initialStartDate,
  initialEndDate,
  initialPage,
}: SalesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useSyncedState(initialStatus ?? "all");
  const [query, setQuery] = useSyncedState(initialQuery ?? "");
  const [startDate, setStartDate] = useSyncedState(initialStartDate ?? "");
  const [endDate, setEndDate] = useSyncedState(initialEndDate ?? "");

  const updateQuery = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");

      for (const key of Array.from(params.keys())) {
        if (!allowedParams.has(key)) {
          params.delete(key);
        }
      }

      for (const [key, value] of Object.entries(updates)) {
        if (!allowedParams.has(key)) {
          continue;
        }

        if (value === null || value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.push(target, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const handleStatusChange = useCallback(
    (nextStatus: string) => {
      setStatus(nextStatus);
      updateQuery({ status: nextStatus === "all" ? null : nextStatus, page: null });
    },
    [setStatus, updateQuery],
  );

  const handleSubmitQuery = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      updateQuery({ q: query.trim() ? query.trim() : null, page: null });
    },
    [query, updateQuery],
  );

  const handlePeriodApply = useCallback(() => {
    updateQuery({
      start_date: startDate.trim() ? startDate.trim() : null,
      end_date: endDate.trim() ? endDate.trim() : null,
      page: null,
    });
  }, [endDate, startDate, updateQuery]);

  const handlePeriodReset = useCallback(() => {
    setStartDate("");
    setEndDate("");
    updateQuery({ start_date: null, end_date: null, page: null });
  }, [setEndDate, setStartDate, updateQuery]);

  const filteredSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sales.filter((sale) => {
      if (!matchesStatus(sale, status)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystacks = [
        sale.saleId,
        sale.productName,
        sale.productId,
        sale.id,
      ];

      return haystacks.some((value) => normalize(value)?.includes(normalizedQuery));
    });
  }, [query, sales, status]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(initialPage, 1), totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleSales = filteredSales.slice(startIndex, startIndex + PAGE_SIZE);

  const totalLabel = filteredSales.length === 1 ? "1 venda" : `${filteredSales.length} vendas`;

  const handlePageChange = useCallback(
    (page: number) => {
      const safePage = Math.max(1, Math.min(page, totalPages));
      updateQuery({ page: safePage > 1 ? String(safePage) : null });
    },
    [totalPages, updateQuery],
  );

  const currentParams = useMemo(() => new URLSearchParams(searchParams?.toString() ?? ""), [searchParams]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-surface-accent/40 bg-surface/60 p-6 shadow-soft">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-primary-foreground">Filtrar resultados</h2>
            <div className="flex flex-wrap items-center gap-3">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStatusChange(option.value)}
                  aria-pressed={status === option.value}
                  className={clsx(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    status === option.value
                      ? "border-primary bg-primary text-primary-foreground shadow-soft"
                      : "border-surface-accent/60 bg-transparent text-muted-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/30 bg-surface-accent/40 p-4">
            <form onSubmit={handleSubmitQuery} className="flex flex-wrap items-center gap-3">
              <label className="flex-1 min-w-[240px]">
                <span className="sr-only">Buscar por produto, ID da venda ou ID do produto</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por produto, ID da venda ou ID do produto"
                  className="w-full rounded-full border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-primary-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
                  type="search"
                />
              </label>
              <button
                type="submit"
                className="rounded-full border border-primary/60 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Buscar
              </button>
            </form>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="start-date" className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Data inicial
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-full border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-primary-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="end-date" className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Data final
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-full border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-primary-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePeriodApply}
                  className="rounded-full border border-primary/60 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  Aplicar período
                </button>
                <button
                  type="button"
                  onClick={handlePeriodReset}
                  className="rounded-full border border-surface-accent/40 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isPending ? "Atualizando resultados…" : `${totalLabel} filtradas`}
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded-full border border-surface-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-transparent disabled:text-muted-foreground/50"
            >
              Anterior
            </button>
            <span className="rounded-full border border-surface-accent/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded-full border border-surface-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-transparent disabled:text-muted-foreground/50"
            >
              Próxima
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-surface-accent/40">
          <table className="min-w-full divide-y divide-surface-accent/40">
            <thead className="bg-surface/80">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <th scope="col" className="px-6 py-4">Venda</th>
                <th scope="col" className="px-6 py-4">Produto</th>
                <th scope="col" className="px-6 py-4">Status</th>
                <th scope="col" className="px-6 py-4">Pagamento</th>
                <th scope="col" className="px-6 py-4">Valor</th>
                <th scope="col" className="px-6 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-accent/30 bg-surface/60">
              {visibleSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma venda encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                visibleSales.map((sale) => {
                  const href = buildDetailHref(sale.saleId, currentParams);
                  const statusBadge = resolveStatusVariant(sale.status);
                  return (
                    <tr
                      key={sale.id}
                      className="group relative cursor-pointer transition-colors hover:bg-surface-accent/40 focus-within:bg-surface-accent/50"
                    >
                      <td className="relative px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-primary-foreground">
                            {sale.saleId}
                          </span>
                          {sale.productId ? (
                            <span className="text-xs text-muted-foreground">Produto #{sale.productId}</span>
                          ) : null}
                        </div>
                        <Link
                          href={href}
                          className="absolute inset-0"
                          aria-label={`Ver detalhes da venda ${sale.saleId}`}
                        />
                      </td>
                      <td className="px-6 py-5 text-sm text-primary-foreground">
                        {sale.productName ?? "Produto não informado"}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={clsx(
                            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]",
                            statusBadge,
                          )}
                        >
                          {sale.statusLabel ?? sale.status ?? "Status desconhecido"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-muted-foreground">
                        {sale.paymentMethod ? sale.paymentMethod.toUpperCase() : "—"}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-primary">
                        {sale.amountDisplay ?? "—"}
                      </td>
                      <td className="px-6 py-5 text-sm text-muted-foreground">
                        {formatDateDisplay(sale.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Exibindo {visibleSales.length} de {filteredSales.length} vendas filtradas
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-surface-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-transparent disabled:text-muted-foreground/50"
            >
              Página anterior
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-full border border-surface-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:border-transparent disabled:text-muted-foreground/50"
            >
              Próxima página
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

