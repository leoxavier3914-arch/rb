import { NextResponse } from "next/server";

import { hasKiwifyApiEnv } from "@/lib/env";
import { kiwifyFetch } from "@/lib/kiwify/client";

const DEFAULT_INTERVAL_DAYS = 30;
const DATE_ONLY_LENGTH = 10;

const toISODate = (date: Date) => date.toISOString().slice(0, DATE_ONLY_LENGTH);

const DEFAULT_PAGE_SIZE = 100;

const clampPage = (value: number, fallback: number, max?: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  const normalized = Math.floor(value);
  if (typeof max === "number") {
    return Math.min(normalized, max);
  }

  return normalized;
};

const normalizeStatus = (status: string | null) => {
  if (!status) return undefined;
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === "all" || normalized === "todos") {
    return undefined;
  }
  return normalized;
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
  const endDate = search.get("end_date") ?? toISODate(now);
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - DEFAULT_INTERVAL_DAYS);
  const startDate = search.get("start_date") ?? toISODate(defaultStart);

  const status = normalizeStatus(search.get("status"));
  const pageNumber = clampPage(
    Number(search.get("page")) || Number(search.get("page_number")) || 1,
    1,
  );
  const pageSize = clampPage(
    Number(search.get("page_size")) || Number(search.get("per_page")) || DEFAULT_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
  );

  try {
    const response = await kiwifyFetch<unknown>("sales", {
      searchParams: {
        page_number: String(pageNumber),
        page_size: String(pageSize),
        status,
        start_date: startDate,
        end_date: endDate,
      },
      cache: "no-store",
    });

    return NextResponse.json({
      data: response,
      meta: {
        start_date: startDate,
        end_date: endDate,
        status: status ?? null,
        page_number: pageNumber,
        page_size: pageSize,
      },
    });
  } catch (error) {
    console.error("Erro ao consultar vendas na Kiwify", error);

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
