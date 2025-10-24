import { headers } from "next/headers";
import { Suspense } from "react";

import { formatCentsBRL } from "@/lib/format/currency";
import { formatDate } from "@/lib/format";
import { formatSaleStatus } from "@/lib/sale-event-metadata";

import SalesTable from "./sales-table";

const candidateKeys = ["data", "items", "results", "sales"] as const;

const getNestedValue = (payload: Record<string, unknown>, path: string): unknown => {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }

    if (Array.isArray(acc)) {
      const index = Number(key);
      if (Number.isInteger(index)) {
        return acc[index];
      }
      return undefined;
    }

    if (typeof acc === "object" && acc && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }

    return undefined;
  }, payload);
};

const pickString = (payload: Record<string, unknown>, paths: string[]): string | null => {
  for (const path of paths) {
    const value = getNestedValue(payload, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const pickNumber = (payload: Record<string, unknown>, paths: string[]): number | null => {
  for (const path of paths) {
    const value = getNestedValue(payload, path);

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const extractSalesCollection = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => typeof item === "object" && !!item) as Record<string, unknown>[];
  }

  if (typeof payload === "object" && payload) {
    for (const key of candidateKeys) {
      const candidate = (payload as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => typeof item === "object" && !!item) as Record<string, unknown>[];
      }
    }
  }

  return [];
};

interface NormalizedSale {
  id: string;
  saleId: string;
  productId: string | null;
  productName: string | null;
  status: string | null;
  statusLabel: string | null;
  paymentMethod: string | null;
  amountCents: number | null;
  amountDisplay: string | null;
  createdAt: string | null;
  createdAtDisplay: string | null;
  updatedAt: string | null;
  raw: Record<string, unknown>;
}

const SALE_ID_PATHS = ["sale_id", "id", "sale.id", "data.sale_id", "data.id"];
const PRODUCT_ID_PATHS = [
  "product_id",
  "product.id",
  "product.product_id",
  "items.0.product.id",
  "items.0.product_id",
  "order.product.id",
  "order.product_id",
  "data.product.id",
  "data.items.0.product.id",
];
const PRODUCT_NAME_PATHS = [
  "product_name",
  "product.name",
  "product.title",
  "items.0.product.name",
  "items.0.name",
  "offer_name",
  "order.product.name",
  "data.product.name",
  "data.items.0.product.name",
];
const STATUS_PATHS = ["status", "data.status", "payment.status", "order.status", "sale.status"];
const PAYMENT_METHOD_PATHS = [
  "payment_method",
  "payment.method",
  "payment.method_name",
  "payment.methodName",
  "payment.payment_method",
  "order.payment.method",
  "data.payment.method",
];
const AMOUNT_PATHS = [
  "net_amount",
  "amount",
  "amount_cents",
  "total_amount",
  "payment.amount",
  "pricing.amount",
  "price",
  "items.0.price",
  "data.net_amount",
  "data.amount",
];
const CREATED_AT_PATHS = [
  "created_at",
  "sale_date",
  "paid_at",
  "order.created_at",
  "data.created_at",
  "data.sale_date",
];
const UPDATED_AT_PATHS = ["updated_at", "data.updated_at", "order.updated_at"];

const normalizeSale = (payload: Record<string, unknown>): NormalizedSale => {
  const saleId = pickString(payload, SALE_ID_PATHS);
  const fallbackId =
    saleId ??
    pickString(payload, ["id", "saleReference", "sale.reference", "reference"]) ??
    `sem-id-${Math.random().toString(36).slice(2, 8)}`;
  const productId = pickString(payload, PRODUCT_ID_PATHS);
  const productName = pickString(payload, PRODUCT_NAME_PATHS);
  const status = pickString(payload, STATUS_PATHS);
  const paymentMethod = pickString(payload, PAYMENT_METHOD_PATHS);
  const amountCents = pickNumber(payload, AMOUNT_PATHS);
  const createdAt = pickString(payload, CREATED_AT_PATHS);
  const updatedAt = pickString(payload, UPDATED_AT_PATHS);

  return {
    id: fallbackId,
    saleId: saleId ?? fallbackId,
    productId,
    productName,
    status,
    statusLabel: formatSaleStatus(status),
    paymentMethod,
    amountCents,
    amountDisplay: formatCentsBRL(amountCents),
    createdAt,
    createdAtDisplay: formatDate(createdAt),
    updatedAt,
    raw: payload,
  };
};

const buildBaseUrl = () => {
  const headersList = headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
};

interface FetchSalesParams {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

const fetchSales = async ({ status, startDate, endDate }: FetchSalesParams) => {
  const baseUrl = buildBaseUrl();
  const url = new URL("/api/sales", baseUrl);

  if (status && status !== "all") {
    url.searchParams.set("status", status);
  }
  if (startDate) {
    url.searchParams.set("start_date", startDate);
  }
  if (endDate) {
    url.searchParams.set("end_date", endDate);
  }

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const fallbackMessage = "Não foi possível carregar as vendas.";
    try {
      const body = await response.json();
      throw new Error(typeof body?.error === "string" ? body.error : fallbackMessage);
    } catch (error) {
      if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
        throw error;
      }
      throw new Error(fallbackMessage);
    }
  }

  const payload = (await response.json()) as { data?: unknown };
  const collection = extractSalesCollection(payload?.data);
  return collection.map(normalizeSale);
};

export const dynamic = "force-dynamic";

interface SalesPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const statusParam = searchParams?.status;
  const status = Array.isArray(statusParam) ? statusParam[0] : statusParam ?? "all";
  const startDateParam = searchParams?.start_date;
  const startDate = Array.isArray(startDateParam) ? startDateParam[0] : startDateParam ?? null;
  const endDateParam = searchParams?.end_date;
  const endDate = Array.isArray(endDateParam) ? endDateParam[0] : endDateParam ?? null;
  const queryParam = searchParams?.q;
  const initialQuery = Array.isArray(queryParam) ? queryParam[0] ?? "" : queryParam ?? "";
  const pageParam = searchParams?.page;
  const initialPage = Number(
    Array.isArray(pageParam) ? pageParam[0] : pageParam,
  );

  let sales: NormalizedSale[] = [];
  let error: string | null = null;

  try {
    sales = await fetchSales({ status, startDate, endDate });
  } catch (err) {
    console.error("Erro ao carregar vendas", err);
    error = err instanceof Error ? err.message : "Erro inesperado ao listar vendas.";
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Acompanhamento</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-primary-foreground">Vendas</h1>
            <p className="text-sm text-muted-foreground">
              Consulte vendas registradas via API oficial da Kiwify com filtros por status, período e busca por produtos.
            </p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">
          {error}
        </div>
      ) : (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando tabela de vendas…</div>}>
          <SalesTable
            sales={sales}
            initialStatus={status ?? "all"}
            initialQuery={initialQuery}
            initialStartDate={startDate}
            initialEndDate={endDate}
            initialPage={Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1}
          />
        </Suspense>
      )}
    </div>
  );
}

export type { NormalizedSale };
