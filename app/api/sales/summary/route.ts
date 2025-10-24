import { NextResponse } from "next/server";

import { hasKiwifyApiEnv } from "@/lib/env";
import { listAllSales } from "@/lib/kiwify/resources";
import {
  BUYER_EMAIL_PATHS,
  BUYER_NAME_PATHS,
  CHARGEBACK_STATUS_PATHS,
  GROSS_AMOUNT_PATHS,
  NET_AMOUNT_PATHS,
  PAYMENT_STATUS_PATHS,
  PRODUCT_ID_PATHS,
  PRODUCT_NAME_PATHS,
  REFUND_STATUS_PATHS,
  SALE_ID_PATHS,
  SPECIFIC_FEE_PATHS,
  STATUS_PATHS,
  TOTAL_FEE_PATHS,
  getNestedValue,
  pickNumber,
  pickString,
} from "@/lib/sales/parsers";

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

const parseDateParam = (value: string | null, fallback: Date) => {
  if (!value) {
    return new Date(fallback);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(fallback);
  }

  return parsed;
};

const normalizeString = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const collectNumbers = (sale: Record<string, unknown>, paths: readonly string[]) => {
  const numbers: number[] = [];
  for (const path of paths) {
    const raw = getNestedValue(sale, path);
    const parsed = parseNumericValue(raw);
    if (parsed !== null) {
      numbers.push(parsed);
    }
  }
  return numbers;
};

const toPositiveCents = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) {
    return null;
  }
  return Math.max(0, rounded);
};

const collectStatusValues = (sale: Record<string, unknown>) => {
  const values = new Set<string>();

  const addValue = (input: unknown) => {
    if (typeof input === "string") {
      const normalized = normalizeString(input);
      if (normalized) {
        values.add(normalized);
      }
    } else if (Array.isArray(input)) {
      for (const item of input) {
        addValue(item);
      }
    }
  };

  const statusSources = [
    ...STATUS_PATHS,
    ...PAYMENT_STATUS_PATHS,
    ...REFUND_STATUS_PATHS,
    ...CHARGEBACK_STATUS_PATHS,
  ];

  for (const path of statusSources) {
    addValue(getNestedValue(sale, path));
  }

  return values;
};

const classifySaleStatus = (sale: Record<string, unknown>) => {
  const statuses = collectStatusValues(sale);
  const statusList = Array.from(statuses);

  const approved = statusList.some(
    (value) =>
      value.includes("paid") ||
      value.includes("aprov") ||
      value.includes("confirm") ||
      value.includes("succeeded"),
  );
  const pending = statusList.some(
    (value) => value.includes("pend") || value.includes("wait") || value.includes("aguard"),
  );
  const refunded = statusList.some((value) => value.includes("refund"));
  const refused = statusList.some(
    (value) =>
      value.includes("refus") ||
      value.includes("reje") ||
      value.includes("fail") ||
      value.includes("cancel") ||
      value.includes("denied"),
  );
  const chargeback = statusList.some((value) => value.includes("charge") || value.includes("contest"));

  return { statuses, approved, pending, refunded, refused, chargeback };
};

const matchesStatusFilter = (
  classification: ReturnType<typeof classifySaleStatus>,
  status: string | undefined,
) => {
  if (!status || status === "all") {
    return true;
  }

  if (status === "paid") {
    return classification.approved;
  }

  if (status === "pending") {
    return classification.pending;
  }

  if (status === "refunded") {
    return classification.refunded;
  }

  if (status === "refused") {
    return classification.refused;
  }

  if (status === "chargeback") {
    return classification.chargeback;
  }

  return Array.from(classification.statuses).some((value) => value.includes(status));
};

const matchesQuery = (sale: Record<string, unknown>, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystacks = new Set<string>();

  const saleId = pickString(sale, SALE_ID_PATHS);
  if (saleId) {
    haystacks.add(normalizeString(saleId));
  }

  const rawId = sale.id;
  if (typeof rawId === "string" && rawId.trim()) {
    haystacks.add(normalizeString(rawId));
  }

  const productName = pickString(sale, PRODUCT_NAME_PATHS);
  if (productName) {
    haystacks.add(normalizeString(productName));
  }

  const productId = pickString(sale, PRODUCT_ID_PATHS);
  if (productId) {
    haystacks.add(normalizeString(productId));
  }

  const buyerName = pickString(sale, BUYER_NAME_PATHS);
  if (buyerName) {
    haystacks.add(normalizeString(buyerName));
  }

  const buyerEmail = pickString(sale, BUYER_EMAIL_PATHS);
  if (buyerEmail) {
    haystacks.add(normalizeString(buyerEmail));
  }

  for (const value of haystacks) {
    if (value.includes(normalizedQuery)) {
      return true;
    }
  }

  return false;
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
  const resolvedEndDate = parseDateParam(search.get("end_date"), now);
  const defaultStart = new Date(resolvedEndDate);
  defaultStart.setDate(defaultStart.getDate() - DEFAULT_SUMMARY_INTERVAL_DAYS);
  const resolvedStartDate = parseDateParam(search.get("start_date"), defaultStart);

  if (resolvedStartDate.getTime() > resolvedEndDate.getTime()) {
    resolvedStartDate.setTime(resolvedEndDate.getTime());
  }

  const startDate = toISODate(resolvedStartDate);
  const endDate = toISODate(resolvedEndDate);

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

    const filteredEntries: { sale: Record<string, unknown>; classification: ReturnType<typeof classifySaleStatus> }[] = [];

    for (const item of result.sales) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const sale = item as Record<string, unknown>;
      const classification = classifySaleStatus(sale);

      if (!matchesStatusFilter(classification, status)) {
        continue;
      }

      if (!matchesQuery(sale, query)) {
        continue;
      }

      filteredEntries.push({ sale, classification });
    }

    let grossTotal = 0;
    let netTotal = 0;
    let commissionTotal = 0;

    const counts = {
      approved: 0,
      pending: 0,
      refunded: 0,
      refused: 0,
      chargeback: 0,
    };

    for (const { sale, classification } of filteredEntries) {
      if (classification.approved) {
        const grossAmount = pickNumber(sale, GROSS_AMOUNT_PATHS);
        const netAmount = pickNumber(sale, NET_AMOUNT_PATHS);
        const totalFee = pickNumber(sale, TOTAL_FEE_PATHS);
        const specificFees = collectNumbers(sale, SPECIFIC_FEE_PATHS);
        const specificFeeSum = specificFees.reduce((acc, value) => acc + value, 0);

        const grossCents = toPositiveCents(grossAmount);
        let netCents = toPositiveCents(netAmount);

        let commissionSource: number | null = null;
        if (specificFees.length > 0) {
          commissionSource = specificFeeSum;
        } else if (totalFee !== null) {
          commissionSource = totalFee;
        } else if (grossAmount !== null && netAmount !== null) {
          commissionSource = grossAmount - netAmount;
        }

        let commissionCents = toPositiveCents(commissionSource);

        if (netCents === null && grossAmount !== null) {
          if (specificFees.length > 0) {
            netCents = toPositiveCents(grossAmount - specificFeeSum);
          } else if (totalFee !== null) {
            netCents = toPositiveCents(grossAmount - totalFee);
          } else if (commissionCents !== null) {
            const fallbackGross = toPositiveCents(grossAmount) ?? 0;
            netCents = Math.max(0, fallbackGross - commissionCents);
          }
        }

        if (commissionCents === null && grossCents !== null && netCents !== null) {
          commissionCents = toPositiveCents(grossCents - netCents);
        }

        if (grossCents !== null) {
          grossTotal += grossCents;
        }

        if (netCents !== null) {
          netTotal += netCents;
        }

        if (commissionCents !== null) {
          commissionTotal += commissionCents;
        }
      }

      if (classification.approved) counts.approved += 1;
      if (classification.pending) counts.pending += 1;
      if (classification.refunded) counts.refunded += 1;
      if (classification.refused) counts.refused += 1;
      if (classification.chargeback) counts.chargeback += 1;
    }

    return NextResponse.json({
      totals: {
        gross_amount_cents: grossTotal,
        net_amount_cents: netTotal,
        kiwify_commission_cents: commissionTotal,
      },
      counts,
      meta: {
        start_date: startDate,
        end_date: endDate,
        status: status ?? null,
        product_id: productId ?? null,
        query: query || null,
        total_sales: filteredEntries.length,
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
