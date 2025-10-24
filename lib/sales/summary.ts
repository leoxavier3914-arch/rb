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
} from "./parsers";

const normalizeString = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const toCents = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) {
    return null;
  }

  return Math.max(0, rounded);
};

const collectStatusTokens = (sale: Record<string, unknown>) => {
  const tokens = new Set<string>();

  const addValue = (input: unknown) => {
    if (typeof input === "string") {
      const normalized = normalizeString(input);
      if (normalized) {
        tokens.add(normalized);
      }
      return;
    }

    if (Array.isArray(input)) {
      for (const value of input) {
        addValue(value);
      }
      return;
    }

    if (input && typeof input === "object") {
      for (const value of Object.values(input)) {
        addValue(value);
      }
    }
  };

  const sources = [
    ...STATUS_PATHS,
    ...PAYMENT_STATUS_PATHS,
    ...REFUND_STATUS_PATHS,
    ...CHARGEBACK_STATUS_PATHS,
  ];

  for (const path of sources) {
    addValue(getNestedValue(sale, path));
  }

  return tokens;
};

const classifyStatus = (sale: Record<string, unknown>) => {
  const statuses = collectStatusTokens(sale);
  const list = Array.from(statuses);

  const approved = list.some(
    (value) =>
      value.includes("paid") ||
      value.includes("aprov") ||
      value.includes("confirm") ||
      value.includes("success") ||
      value.includes("succeeded"),
  );

  const pending = list.some(
    (value) =>
      value.includes("pend") ||
      value.includes("await") ||
      value.includes("aguard") ||
      value.includes("wait"),
  );

  const refunded = list.some((value) => value.includes("refund") || value.includes("reemb"));
  const refused = list.some(
    (value) =>
      value.includes("refus") ||
      value.includes("reject") ||
      value.includes("rejei") ||
      value.includes("fail") ||
      value.includes("cancel") ||
      value.includes("denied"),
  );
  const chargeback = list.some((value) => value.includes("charge") || value.includes("contest"));

  return { statuses, approved, pending, refunded, refused, chargeback };
};

const collectNumericValues = (value: unknown): number[] => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [value];
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
    if (!normalized) {
      return [];
    }

    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? [] : [parsed];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNumericValues(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectNumericValues(item));
  }

  return [];
};

const collectSpecificFees = (sale: Record<string, unknown>) => {
  const numbers: number[] = [];
  for (const path of SPECIFIC_FEE_PATHS) {
    const value = getNestedValue(sale, path);
    numbers.push(...collectNumericValues(value));
  }
  return numbers;
};

const matchesStatusFilter = (
  classification: ReturnType<typeof classifyStatus>,
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

  const saleId = pickString(sale, SALE_ID_PATHS) ?? (typeof sale.id === "string" ? sale.id : null);
  if (saleId) {
    haystacks.add(saleId.toLowerCase());
  }

  const productId = pickString(sale, PRODUCT_ID_PATHS);
  if (productId) {
    haystacks.add(productId.toLowerCase());
  }

  const productName = pickString(sale, PRODUCT_NAME_PATHS);
  if (productName) {
    haystacks.add(productName.toLowerCase());
  }

  const buyerName = pickString(sale, BUYER_NAME_PATHS);
  if (buyerName) {
    haystacks.add(buyerName.toLowerCase());
  }

  const buyerEmail = pickString(sale, BUYER_EMAIL_PATHS);
  if (buyerEmail) {
    haystacks.add(buyerEmail.toLowerCase());
  }

  for (const value of haystacks) {
    if (value.includes(normalizedQuery)) {
      return true;
    }
  }

  return false;
};

export interface SalesSummaryCounts {
  approved: number;
  pending: number;
  refunded: number;
  refused: number;
  chargeback: number;
}

export interface SalesSummaryTotals {
  gross_amount_cents: number;
  net_amount_cents: number;
  kiwify_commission_cents: number;
}

export interface SummarizeOptions {
  sales: Record<string, unknown>[];
  status?: string;
  query?: string;
}

export interface SummarizeResult {
  totals: SalesSummaryTotals;
  counts: SalesSummaryCounts;
  filteredCount: number;
}

export const summarizeSales = ({ sales, status, query }: SummarizeOptions): SummarizeResult => {
  const totals: SalesSummaryTotals = {
    gross_amount_cents: 0,
    net_amount_cents: 0,
    kiwify_commission_cents: 0,
  };

  const counts: SalesSummaryCounts = {
    approved: 0,
    pending: 0,
    refunded: 0,
    refused: 0,
    chargeback: 0,
  };

  const filteredEntries: { sale: Record<string, unknown>; classification: ReturnType<typeof classifyStatus> }[] = [];

  for (const sale of sales) {
    if (!sale || typeof sale !== "object") {
      continue;
    }

    const record = sale as Record<string, unknown>;
    const classification = classifyStatus(record);

    if (!matchesStatusFilter(classification, status)) {
      continue;
    }

    if (!matchesQuery(record, query ?? "")) {
      continue;
    }

    filteredEntries.push({ sale: record, classification });
  }

  for (const { sale, classification } of filteredEntries) {
    if (classification.approved) {
      const gross = pickNumber(sale, GROSS_AMOUNT_PATHS);
      const net = pickNumber(sale, NET_AMOUNT_PATHS);
      const totalFee = pickNumber(sale, TOTAL_FEE_PATHS);
      const specificFees = collectSpecificFees(sale);
      const specificFeeSum = specificFees.reduce((acc, value) => acc + value, 0);

      const grossCents = toCents(gross);
      let netCents = toCents(net);

      let commissionSource: number | null = null;
      if (specificFees.length > 0) {
        commissionSource = specificFeeSum;
      } else if (totalFee !== null) {
        commissionSource = totalFee;
      } else if (gross !== null && net !== null) {
        commissionSource = gross - net;
      }

      let commissionCents = toCents(commissionSource ?? null);

      if (netCents === null && gross !== null) {
        if (specificFees.length > 0) {
          netCents = toCents(gross - specificFeeSum);
        } else if (totalFee !== null) {
          netCents = toCents(gross - totalFee);
        }
      }

      if (commissionCents === null && grossCents !== null && netCents !== null) {
        commissionCents = toCents(grossCents - netCents);
      }

      if (grossCents !== null) {
        totals.gross_amount_cents += grossCents;
      }

      if (netCents !== null) {
        totals.net_amount_cents += netCents;
      }

      if (commissionCents !== null) {
        totals.kiwify_commission_cents += commissionCents;
      }
    }

    if (classification.approved) counts.approved += 1;
    if (classification.pending) counts.pending += 1;
    if (classification.refunded) counts.refunded += 1;
    if (classification.refused) counts.refused += 1;
    if (classification.chargeback) counts.chargeback += 1;
  }

  return {
    totals,
    counts,
    filteredCount: filteredEntries.length,
  };
};
