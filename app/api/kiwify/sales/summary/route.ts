import { NextResponse } from "next/server";

import { hasKiwifyApiEnv } from "@/lib/env";
import { listAllSales } from "@/lib/kiwify/resources";
import { summarizeSales } from "@/lib/sales/summary";

const DEFAULT_SUMMARY_INTERVAL_DAYS = 30;
const DATE_ONLY_LENGTH = 10;
const DEFAULT_PAGE_SIZE = 100;

const toISODate = (date: Date) => date.toISOString().slice(0, DATE_ONLY_LENGTH);

const normalizeStatus = (status: string | null) => {
  if (!status) return undefined;
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === "all" || normalized === "todos") {
    return undefined;
  }
  return normalized;
};

const parseDateOrFallback = (value: string | null, fallback: Date) => {
  if (!value) {
    return new Date(fallback);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(fallback);
  }

  return parsed;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasKiwifyApiEnv()) {
    return NextResponse.json(
      { error: "API da Kiwify não configurada." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const search = url.searchParams;

  const now = new Date();
  const endDateResolved = parseDateOrFallback(search.get("end_date"), now);
  const startDefault = new Date(endDateResolved);
  startDefault.setDate(startDefault.getDate() - DEFAULT_SUMMARY_INTERVAL_DAYS);
  const startDateResolved = parseDateOrFallback(search.get("start_date"), startDefault);

  if (startDateResolved.getTime() > endDateResolved.getTime()) {
    startDateResolved.setTime(endDateResolved.getTime());
  }

  const startDate = toISODate(startDateResolved);
  const endDate = toISODate(endDateResolved);

  const status = normalizeStatus(search.get("status"));
  const productId = search.get("product_id");
  const query = search.get("q")?.trim() ?? "";

  try {
    const result = await listAllSales({
      startDate,
      endDate,
      status,
      productId: productId ?? undefined,
      perPage: DEFAULT_PAGE_SIZE,
    });

    const summary = summarizeSales({
      sales: result.sales as Record<string, unknown>[],
      status,
      query,
    });

    return NextResponse.json({
      totals: summary.totals,
      counts: summary.counts,
      meta: {
        start_date: startDate,
        end_date: endDate,
        status: status ?? null,
        product_id: productId ?? null,
        query: query || null,
        total_sales: summary.filteredCount,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar resumo de vendas", error);

    const body =
      error instanceof Error
        ? { error: error.message, status: "error" }
        : { error: "Falha desconhecida", status: "error" };

    const statusCode =
      typeof (error as { status?: number }).status === "number"
        ? (error as { status?: number }).status!
        : 500;

    return NextResponse.json(body, { status: statusCode });
  }
}
