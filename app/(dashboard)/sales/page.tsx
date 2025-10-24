import { headers } from "next/headers";
import { Suspense } from "react";

import { formatCentsBRL } from "@/lib/format/currency";
import { formatDate } from "@/lib/format";
import { formatSaleStatus } from "@/lib/sale-event-metadata";
import {
  AMOUNT_PATHS,
  BUYER_EMAIL_PATHS,
  BUYER_NAME_PATHS,
  PRODUCT_ID_PATHS,
  PRODUCT_NAME_PATHS,
  SALE_ID_PATHS,
  STATUS_PATHS,
  PAYMENT_METHOD_PATHS,
  CREATED_AT_PATHS,
  UPDATED_AT_PATHS,
  extractSalesCollection,
  pickNumber,
  pickString,
} from "@/lib/sales/parsers";

import SalesTable from "./sales-table";

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
  buyerName: string | null;
  buyerEmail: string | null;
  raw: Record<string, unknown>;
}

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
  const buyerName = pickString(payload, BUYER_NAME_PATHS);
  const buyerEmail = pickString(payload, BUYER_EMAIL_PATHS);

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
    buyerName,
    buyerEmail,
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
  productId?: string | null;
}

const fetchSales = async ({ status, startDate, endDate, productId }: FetchSalesParams) => {
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
  if (productId) {
    url.searchParams.set("product_id", productId);
  }
  url.searchParams.set("fetch", "all");

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

interface SalesSummaryTotals {
  gross_amount_cents: number;
  net_amount_cents: number;
  kiwify_commission_cents: number;
}

interface SalesSummaryCounts {
  approved: number;
  pending: number;
  refunded: number;
  refused: number;
  chargeback: number;
}

interface SalesSummaryMeta {
  start_date: string;
  end_date: string;
  status: string | null;
  product_id: string | null;
  query: string | null;
  total_sales: number;
}

interface SalesSummaryResponse {
  totals: SalesSummaryTotals;
  counts: SalesSummaryCounts;
  meta: SalesSummaryMeta;
}

const fetchSummary = async ({
  status,
  startDate,
  endDate,
  productId,
  query,
}: FetchSalesParams & { query?: string | null }) => {
  const baseUrl = buildBaseUrl();
  const url = new URL("/api/sales/summary", baseUrl);

  if (status && status !== "all") {
    url.searchParams.set("status", status);
  }
  if (startDate) {
    url.searchParams.set("start_date", startDate);
  }
  if (endDate) {
    url.searchParams.set("end_date", endDate);
  }
  if (productId) {
    url.searchParams.set("product_id", productId);
  }
  if (query) {
    url.searchParams.set("q", query);
  }

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const fallbackMessage = "Não foi possível carregar o resumo de vendas.";
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

  return (await response.json()) as SalesSummaryResponse;
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
  const productParam = searchParams?.product_id;
  const productId = Array.isArray(productParam) ? productParam[0] : productParam ?? null;
  const pageParam = searchParams?.page;
  const initialPage = Number(
    Array.isArray(pageParam) ? pageParam[0] : pageParam,
  );

  let sales: NormalizedSale[] = [];
  let error: string | null = null;
  let summary: SalesSummaryResponse | null = null;
  let summaryError: string | null = null;

  const [salesResult, summaryResult] = await Promise.allSettled([
    fetchSales({ status, startDate, endDate, productId }),
    fetchSummary({ status, startDate, endDate, productId, query: initialQuery }),
  ]);

  if (salesResult.status === "fulfilled") {
    sales = salesResult.value;
  } else {
    console.error("Erro ao carregar vendas", salesResult.reason);
    error =
      salesResult.reason instanceof Error
        ? salesResult.reason.message
        : "Erro inesperado ao listar vendas.";
  }

  if (summaryResult.status === "fulfilled") {
    summary = summaryResult.value;
  } else {
    console.error("Erro ao carregar resumo de vendas", summaryResult.reason);
    summaryError =
      summaryResult.reason instanceof Error
        ? summaryResult.reason.message
        : "Erro inesperado ao gerar o resumo de vendas.";
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
            summary={summary}
            summaryError={summaryError}
          />
        </Suspense>
      )}
    </div>
  );
}

export type { NormalizedSale, SalesSummaryResponse as SalesSummary };
