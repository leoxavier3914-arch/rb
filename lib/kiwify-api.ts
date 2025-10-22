import { getKiwifyApiEnv, hasKiwifyApiEnv } from "./env";

interface RequestOptions {
  searchParams?: Record<string, string | number | null | undefined>;
  init?: RequestInit;
}

interface RequestResult {
  ok: boolean;
  status: number;
  payload: unknown;
  error?: string;
}

type UnknownRecord = Record<string, unknown>;

type StringArray = string[];

const ARRAY_LIKE_KEYS = [
  "items",
  "data",
  "results",
  "records",
  "entries",
  "subscriptions",
  "enrollments",
  "events",
  "list",
  "nodes",
];

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ensureArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (isRecord(value)) {
    for (const key of ARRAY_LIKE_KEYS) {
      const nested = value[key];
      if (Array.isArray(nested)) {
        return nested;
      }
    }
  }

  return value !== undefined && value !== null ? [value] : [];
};

const getValueAtPath = (value: unknown, path: string): unknown => {
  if (!path) {
    return value;
  }

  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }

    if (Array.isArray(acc)) {
      const index = Number.parseInt(segment, 10);
      if (Number.isNaN(index)) {
        return undefined;
      }
      return acc[index];
    }

    if (typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }

    return undefined;
  }, value);
};

const coerceString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return null;
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (isRecord(value)) {
    if ("amount" in value) {
      const amount = coerceNumber(value.amount);
      if (amount !== null) {
        return amount;
      }
    }

    if ("value" in value) {
      const amount = coerceNumber(value.value);
      if (amount !== null) {
        return amount;
      }
    }

    if ("total" in value) {
      const amount = coerceNumber(value.total);
      if (amount !== null) {
        return amount;
      }
    }

    if ("gross" in value) {
      const amount = coerceNumber(value.gross);
      if (amount !== null) {
        return amount;
      }
    }

    if ("net" in value) {
      const amount = coerceNumber(value.net);
      if (amount !== null) {
        return amount;
      }
    }
  }

  return null;
};

const coerceBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "sim"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "não", "nao"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return null;
};

const AUTHORIZATION_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*\s/i;

const formatAuthorizationHeader = (token: string): string => {
  const normalized = token.trim();

  if (!normalized) {
    return normalized;
  }

  return AUTHORIZATION_SCHEME_REGEX.test(normalized)
    ? normalized
    : `Bearer ${normalized}`;
};

const extractString = (value: unknown, paths: StringArray): string | null => {
  for (const path of paths) {
    const extracted = getValueAtPath(value, path);
    const stringValue = coerceString(extracted);
    if (stringValue) {
      return stringValue;
    }
  }
  return null;
};

const extractNumber = (value: unknown, paths: StringArray): number | null => {
  for (const path of paths) {
    const extracted = getValueAtPath(value, path);
    const numericValue = coerceNumber(extracted);
    if (numericValue !== null) {
      return numericValue;
    }
  }
  return null;
};

const extractBoolean = (value: unknown, paths: StringArray): boolean | null => {
  for (const path of paths) {
    const extracted = getValueAtPath(value, path);
    const booleanValue = coerceBoolean(extracted);
    if (booleanValue !== null) {
      return booleanValue;
    }
  }
  return null;
};

const extractStringArray = (value: unknown, paths: StringArray): string[] => {
  for (const path of paths) {
    const extracted = getValueAtPath(value, path);
    if (Array.isArray(extracted)) {
      const normalized = extracted
        .map((item) => coerceString(item))
        .filter((item): item is string => Boolean(item));
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return [];
};

const normalizeCentsAmount = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }

  return value / 100;
};

const OFFER_PRICE_PATHS = [
  "price",
  "amount",
  "value",
  "default_price",
  "defaultPrice",
  "current_price",
  "currentPrice",
  "pricing.price",
  "pricing.amount",
  "pricing.value",
  "pricing.total",
  "price.amount",
  "price.value",
  "price.total",
  "plan.price",
  "plan.amount",
  "plan.value",
  "plan.total",
  "plan.price.amount",
  "plan.price.value",
  "plan.price.total",
];

const OFFER_PRICE_CENTS_PATHS = [
  "price_cents",
  "priceCents",
  "amount_cents",
  "amountCents",
  "value_cents",
  "valueCents",
  "total_cents",
  "totalCents",
  "default_price_cents",
  "defaultPriceCents",
  "current_price_cents",
  "currentPriceCents",
  "pricing.price_cents",
  "pricing.amount_cents",
  "pricing.value_cents",
  "pricing.total_cents",
  "price.price_cents",
  "price.priceCents",
  "price.amount_cents",
  "price.amountCents",
  "price.value_cents",
  "price.valueCents",
  "price.total_cents",
  "price.totalCents",
  "plan.price_cents",
  "plan.priceCents",
  "plan.amount_cents",
  "plan.amountCents",
  "plan.value_cents",
  "plan.valueCents",
  "plan.total_cents",
  "plan.totalCents",
  "plan.price.price_cents",
  "plan.price.priceCents",
  "plan.price.amount_cents",
  "plan.price.amountCents",
  "plan.price.value_cents",
  "plan.price.valueCents",
  "plan.price.total_cents",
  "plan.price.totalCents",
];

const PRICE_HINTS = [
  "price",
  "amount",
  "value",
  "payment",
  "plan",
  "pricing",
];

const normalizeKeyForComparison = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();

const isPriceHint = (key: string | undefined): key is string => {
  if (!key) {
    return false;
  }

  const normalized = normalizeKeyForComparison(key);
  return PRICE_HINTS.some((hint) => normalized.includes(hint));
};

const isCentsHint = (key: string | undefined): key is string => {
  if (!key) {
    return false;
  }

  return normalizeKeyForComparison(key).includes("cent");
};

const extractPriceFromOfferFields = (
  value: unknown,
  keyHint?: string,
  visited: WeakSet<object> = new WeakSet(),
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    if (!isPriceHint(keyHint)) {
      return null;
    }
    return isCentsHint(keyHint) ? normalizeCentsAmount(value) : value;
  }

  if (typeof value === "string") {
    if (!isPriceHint(keyHint)) {
      return null;
    }
    const numeric = coerceNumber(value);
    if (numeric === null) {
      return null;
    }
    return isCentsHint(keyHint) ? normalizeCentsAmount(numeric) : numeric;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (visited.has(value as object)) {
    return null;
  }
  visited.add(value as object);

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractPriceFromOfferFields(item, keyHint, visited);
      if (nested !== null) {
        return nested;
      }
    }
    return null;
  }

  const record = value as UnknownRecord;

  const directPrice = extractNumber(record, OFFER_PRICE_PATHS);
  if (directPrice !== null) {
    return directPrice;
  }

  const centsPrice = extractNumber(record, OFFER_PRICE_CENTS_PATHS);
  const normalized = normalizeCentsAmount(centsPrice);
  if (normalized !== null) {
    return normalized;
  }

  for (const key of OFFER_INSTALLMENT_KEYS) {
    const installments = record[key];
    const priceFromInstallments = extractPriceFromInstallments(installments, visited);
    if (priceFromInstallments !== null) {
      return priceFromInstallments;
    }
  }

  for (const [key, field] of Object.entries(record)) {
    if (!isPriceHint(key)) {
      continue;
    }
    const nested = extractPriceFromOfferFields(field, key, visited);
    if (nested !== null) {
      return nested;
    }
  }

  for (const [key, field] of Object.entries(record)) {
    if (!field || typeof field !== "object") {
      continue;
    }
    const nested = extractPriceFromOfferFields(field, key, visited);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
};

const extractPriceFromInstallments = (
  installments: unknown,
  visited?: WeakSet<object>,
): number | null => {
  for (const installment of ensureArray(installments)) {
    if (!isRecord(installment)) {
      continue;
    }

    const directPrice = extractNumber(installment, OFFER_PRICE_PATHS);
    if (directPrice !== null) {
      return directPrice;
    }

    const centsPrice = extractNumber(installment, OFFER_PRICE_CENTS_PATHS);
    const normalized = normalizeCentsAmount(centsPrice);
    if (normalized !== null) {
      return normalized;
    }

    const nestedPrice = extractPriceFromOfferFields(
      installment,
      undefined,
      visited ?? new WeakSet<object>(),
    );
    if (nestedPrice !== null) {
      return nestedPrice;
    }
  }

  return null;
};

const OFFER_INSTALLMENT_KEYS = [
  "installments",
  "installment_options",
  "installmentOptions",
  "payment_plans",
  "paymentPlans",
  "plans",
] as const;

const extractPriceFromOffer = (offer: unknown): number | null => {
  if (offer === null || offer === undefined) {
    return null;
  }

  if (Array.isArray(offer)) {
    for (const entry of offer) {
      const price = extractPriceFromOffer(entry);
      if (price !== null) {
        return price;
      }
    }
    return null;
  }

  if (!isRecord(offer)) {
    return null;
  }

  const visited = new WeakSet<object>();

  const directPrice = extractNumber(offer, OFFER_PRICE_PATHS);
  if (directPrice !== null) {
    return directPrice;
  }

  const centsPrice = extractNumber(offer, OFFER_PRICE_CENTS_PATHS);
  const normalized = normalizeCentsAmount(centsPrice);
  if (normalized !== null) {
    return normalized;
  }

  for (const key of OFFER_INSTALLMENT_KEYS) {
    const installments = (offer as UnknownRecord)[key];
    const priceFromInstallments = extractPriceFromInstallments(installments, visited);
    if (priceFromInstallments !== null) {
      return priceFromInstallments;
    }
  }

  return extractPriceFromOfferFields(offer, undefined, visited);
};

const kiwifyRequest = async (path: string, { searchParams, init }: RequestOptions = {}): Promise<RequestResult> => {
  if (!hasKiwifyApiEnv()) {
    return {
      ok: false,
      status: 0,
      payload: null,
      error: "As credenciais da API da Kiwify não foram configuradas.",
    };
  }

  try {
    const env = getKiwifyApiEnv();
    const base = env.KIWIFY_API_BASE_URL.endsWith("/")
      ? env.KIWIFY_API_BASE_URL
      : `${env.KIWIFY_API_BASE_URL}/`;
    const normalizedPath = path.replace(/^\/+/, "");
    const url = new URL(normalizedPath, base);

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value === null || value === undefined) {
        continue;
      }
      const normalized = String(value);
      if (normalized.trim().length > 0) {
        params.set(key, normalized);
      }
    }

    const shouldIncludeAccountId = normalizedPath.startsWith("api/v1/");
    if (shouldIncludeAccountId && !params.has("account_id")) {
      params.set("account_id", env.KIWIFY_API_ACCOUNT_ID);
    }

    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const headers = new Headers(init?.headers ?? {});
    if (!headers.has("Authorization")) {
      headers.set("Authorization", formatAuthorizationHeader(env.KIWIFY_API_TOKEN));
    }
    headers.set("Accept", "application/json");
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!headers.has("x-kiwify-account-id")) {
      headers.set("x-kiwify-account-id", env.KIWIFY_API_ACCOUNT_ID);
    }

    const response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });

    const { status } = response;
    if (status === 204) {
      return { ok: true, status, payload: null };
    }

    const text = await response.text();
    let payload: unknown = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = text;
      }
    }

    if (!response.ok) {
      const messages = new Set<string>();

      const appendMessage = (value: unknown) => {
        if (!value) {
          return;
        }

        if (typeof value === "string") {
          const normalized = value.trim();
          if (normalized.length > 0) {
            messages.add(normalized);
          }
          return;
        }

        if (Array.isArray(value)) {
          for (const item of value) {
            appendMessage(item);
          }
          return;
        }

        if (isRecord(value)) {
          for (const item of Object.values(value)) {
            appendMessage(item);
          }
        }
      };

      if (isRecord(payload)) {
        appendMessage(payload.message);
        appendMessage((payload as { error?: unknown }).error);
        appendMessage((payload as { error_description?: unknown }).error_description);
        appendMessage((payload as { errorDescription?: unknown }).errorDescription);
        if ("errors" in payload) {
          appendMessage(payload.errors);
        }
      } else {
        appendMessage(payload);
      }

      const message =
        messages.size > 0 ? Array.from(messages).join(" ") : `Erro ${status} ao consultar a API da Kiwify.`;

      return { ok: false, status, payload, error: message };
    }

    return { ok: true, status, payload };
  } catch (error) {
    console.error("Erro ao chamar a API da Kiwify", error);
    return {
      ok: false,
      status: 0,
      payload: null,
      error: error instanceof Error ? error.message : "Falha desconhecida na API da Kiwify.",
    };
  }
};

export const hasKiwifyApiConfig = () => hasKiwifyApiEnv();

export interface SalesStatisticsTotals {
  totalOrders: number;
  grossAmount: number;
  netAmount: number;
  kiwifyCommission: number;
  affiliateCommission: number;
  currency: string | null;
  averageTicket: number | null;
}

export interface SalesStatisticsBreakdownItem {
  label: string;
  grossAmount: number | null;
  netAmount: number | null;
  orders: number | null;
  currency: string | null;
}

export interface SalesStatisticsResult {
  totals: SalesStatisticsTotals;
  breakdown: SalesStatisticsBreakdownItem[];
  raw: unknown;
  error?: string;
}

const DEFAULT_SALES_TOTALS: SalesStatisticsTotals = {
  totalOrders: 0,
  grossAmount: 0,
  netAmount: 0,
  kiwifyCommission: 0,
  affiliateCommission: 0,
  currency: "BRL",
  averageTicket: null,
};

const SALES_SUMMARY_PATHS: StringArray[] = [
  ["summary"],
  ["totals"],
  ["statistics"],
  ["stats"],
  ["overview"],
  [],
];

export interface SalesStatisticsFilters {
  startDate?: string;
  endDate?: string;
  groupBy?: "day" | "month" | "product" | "source";
}

const parseDateInput = (value?: string): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAsDateParam = (date: Date): string => date.toISOString().slice(0, 10);

const formatPeriodLabel = (date: Date, groupBy: "day" | "month"): string => {
  const [year, month, day] = date.toISOString().split("T")[0]?.split("-") ?? [];

  if (groupBy === "month") {
    return month && year ? `${month}/${year}` : date.toISOString();
  }

  return day && month && year ? `${day}/${month}/${year}` : date.toISOString();
};

const buildTimelineFromSales = (
  salesPayload: unknown,
  groupBy: "day" | "month",
  fallbackCurrency: string | null,
): SalesStatisticsBreakdownItem[] => {
  const sales = ensureArray(salesPayload)
    .map((entry) => (isRecord(entry) ? entry : null))
    .filter((entry): entry is UnknownRecord => entry !== null);

  if (sales.length === 0) {
    return [];
  }

  const groups = new Map<
    string,
    {
      label: string;
      grossAmount: number;
      netAmount: number;
      orders: number;
      currency: string | null;
    }
  >();

  for (const sale of sales) {
    const dateString =
      extractString(sale, [
        "period",
        "date",
        "paid_at",
        "paidAt",
        "created_at",
        "createdAt",
        "updated_at",
        "order_date",
      ]) ?? null;

    if (!dateString) {
      continue;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const key =
      groupBy === "month"
        ? date.toISOString().slice(0, 7)
        : date.toISOString().slice(0, 10);

    const label = formatPeriodLabel(date, groupBy);

    let grossAmount =
      extractNumber(sale, [
        "gross_amount",
        "grossAmount",
        "gross",
        "amount",
        "total_amount",
        "total",
        "amount.gross",
      ]) ?? 0;

    if (grossAmount === 0) {
      const grossCents = extractNumber(sale, [
        "gross_amount_cents",
        "grossAmountCents",
        "gross_cents",
        "amount_cents",
        "total_amount_cents",
      ]);
      if (grossCents !== null) {
        grossAmount = grossCents / 100;
      }
    }

    let netAmount =
      extractNumber(sale, [
        "net_amount",
        "netAmount",
        "net",
        "amount.net",
        "total_net",
      ]) ?? 0;

    if (netAmount === 0) {
      const netCents = extractNumber(sale, [
        "net_amount_cents",
        "netAmountCents",
        "net_cents",
      ]);
      if (netCents !== null) {
        netAmount = netCents / 100;
      }
    }

    const quantity =
      extractNumber(sale, [
        "quantity",
        "items_count",
        "total_items",
        "total_sales",
        "orders",
      ]) ?? 1;

    const currency =
      extractString(sale, [
        "currency",
        "currency_code",
        "currencyCode",
        "amount.currency",
        "order.currency",
      ]) ?? fallbackCurrency;

    const current = groups.get(key);

    if (current) {
      current.grossAmount += grossAmount;
      current.netAmount += netAmount;
      current.orders += quantity;
      if (!current.currency && currency) {
        current.currency = currency;
      }
    } else {
      groups.set(key, {
        label,
        grossAmount,
        netAmount,
        orders: quantity,
        currency,
      });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => ({
      label: value.label,
      grossAmount: value.grossAmount,
      netAmount: value.netAmount,
      orders: value.orders,
      currency: value.currency,
    }));
};

export interface KiwifySalesFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  updatedAtStartDate?: string;
  updatedAtEndDate?: string;
  productId?: string;
  affiliateId?: string;
  page?: number;
  perPage?: number;
  viewFullSaleDetails?: boolean;
}

export interface KiwifySalesPagination {
  pageNumber: number | null;
  pageSize: number | null;
  totalCount: number | null;
  totalPages: number | null;
  startDate: string | null;
  endDate: string | null;
  updatedAtStartDate: string | null;
  updatedAtEndDate: string | null;
}

export interface KiwifySaleParty {
  id: string | null;
  name: string | null;
  email: string | null;
  document: string | null;
  phone: string | null;
}

export interface KiwifySaleProductSummary {
  id: string | null;
  name: string | null;
}

export interface KiwifySaleSummary {
  id: string | null;
  orderId: string | null;
  reference: string | null;
  status: string | null;
  paymentMethod: string | null;
  installments: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  currency: string | null;
  kiwifyCommission: number | null;
  affiliateCommission: number | null;
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  customer: KiwifySaleParty;
  product: KiwifySaleProductSummary;
  raw: UnknownRecord | null;
}

export interface KiwifyRevenuePartner {
  accountId: string | null;
  legalName: string | null;
  documentId: string | null;
  percentage: number | null;
  amount: number | null;
  role: string | null;
}

export interface KiwifySaleDetail extends KiwifySaleSummary {
  totalAmount: number | null;
  boletoUrl: string | null;
  pixKey: string | null;
  pixQrCode: string | null;
  cardLastDigits: string | null;
  cardBrand: string | null;
  affiliate: {
    id: string | null;
    name: string | null;
    email: string | null;
  };
  shipping: {
    id: string | null;
    name: string | null;
    price: number | null;
  };
  revenuePartners: KiwifyRevenuePartner[];
}

export interface KiwifySalesResult {
  sales: KiwifySaleSummary[];
  pagination: KiwifySalesPagination | null;
  raw: unknown;
  error?: string;
}

export interface KiwifySaleDetailResult {
  sale: KiwifySaleDetail | null;
  raw: unknown;
  error?: string;
}

const normalizeInstallments = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }

  const rounded = Math.round(value);
  return Number.isNaN(rounded) ? null : rounded;
};

const mapSaleSummary = (record: UnknownRecord): KiwifySaleSummary => {
  const customerPayload = getValueAtPath(record, "customer");
  const productPayload = getValueAtPath(record, "product");

  const customer: KiwifySaleParty = {
    id:
      extractString(customerPayload, [
        "id",
        "customer_id",
        "buyer_id",
        "customer.id",
      ]) ?? null,
    name:
      extractString(customerPayload, [
        "name",
        "full_name",
        "display_name",
        "customer_name",
      ]) ?? null,
    email:
      extractString(customerPayload, [
        "email",
        "mail",
        "customer_email",
        "buyer_email",
      ]) ?? null,
    document:
      extractString(customerPayload, [
        "document",
        "document_id",
        "cpf",
        "cnpj",
        "tax_id",
      ]) ?? null,
    phone:
      extractString(customerPayload, [
        "mobile",
        "phone",
        "phone_number",
        "phoneNumber",
        "customer_phone",
      ]) ?? null,
  };

  const product: KiwifySaleProductSummary = {
    id:
      extractString(productPayload, [
        "id",
        "product_id",
        "uuid",
        "product.id",
      ]) ?? null,
    name:
      extractString(productPayload, [
        "name",
        "title",
        "product_name",
        "display_name",
      ]) ?? null,
  };

  const orderId =
    extractString(record, ["order_id", "orderId", "sale_id", "saleId"]) ?? null;
  const saleId = extractString(record, ["id", "sale_id", "order_id"]) ?? orderId;

  const grossAmount =
    extractNumber(record, [
      "gross_amount",
      "amount_gross",
      "totals.gross",
      "payment.gross_amount",
      "summary.gross",
    ]) ?? null;

  const netAmountBase =
    extractNumber(record, [
      "net_amount",
      "amount",
      "totals.net",
      "payment.net_amount",
      "summary.net",
    ]) ?? null;

  const kiwifyCommission =
    extractNumber(record, [
      "kiwify_commission",
      "commission.kiwify",
      "commissions.kiwify",
      "kiwify_commission_amount",
    ]) ?? null;

  const affiliateCommission =
    extractNumber(record, [
      "affiliate_commission",
      "commission.affiliate",
      "commissions.affiliate",
      "affiliate_commission_amount",
    ]) ?? null;

  return {
    id: saleId ?? null,
    orderId,
    reference:
      extractString(record, ["reference", "order_reference", "sale_reference"]) ??
      null,
    status: extractString(record, ["status", "state", "sale_status"]) ?? null,
    paymentMethod:
      extractString(record, [
        "payment_method",
        "payment.method",
        "payment_method_name",
        "payment.method_name",
      ]) ?? null,
    installments: normalizeInstallments(
      extractNumber(record, [
        "installments",
        "payment.installments",
        "payment.number_installments",
      ]) ?? null,
    ),
    grossAmount,
    netAmount: netAmountBase,
    currency:
      extractString(record, [
        "currency",
        "currency_code",
        "payment.currency",
        "summary.currency",
      ]) ?? null,
    kiwifyCommission,
    affiliateCommission,
    approvedAt:
      extractString(record, [
        "approved_date",
        "approved_at",
        "paid_at",
        "payment.approved_date",
        "payment.paid_at",
      ]) ?? null,
    createdAt:
      extractString(record, ["created_at", "createdAt", "timestamps.created_at"]) ??
      null,
    updatedAt:
      extractString(record, ["updated_at", "updatedAt", "timestamps.updated_at"]) ??
      null,
    customer,
    product,
    raw: record,
  } satisfies KiwifySaleSummary;
};

const mapSalesPagination = (value: unknown): KiwifySalesPagination | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    pageNumber:
      extractNumber(value, ["page_number", "pageNumber", "current_page"]) ?? null,
    pageSize:
      extractNumber(value, ["page_size", "pageSize", "limit", "per_page"]) ??
      null,
    totalCount:
      extractNumber(value, [
        "count",
        "total_count",
        "total_items",
        "total",
      ]) ?? null,
    totalPages:
      extractNumber(value, ["total_pages", "page_count", "pages"]) ?? null,
    startDate:
      extractString(value, ["start_date", "startDate", "from_date"]) ?? null,
    endDate:
      extractString(value, ["end_date", "endDate", "to_date"]) ?? null,
    updatedAtStartDate:
      extractString(value, [
        "updated_at_start_date",
        "updatedAtStartDate",
        "updated_start",
      ]) ?? null,
    updatedAtEndDate:
      extractString(value, [
        "updated_at_end_date",
        "updatedAtEndDate",
        "updated_end",
      ]) ?? null,
  } satisfies KiwifySalesPagination;
};

export async function getKiwifySales(
  filters: KiwifySalesFilters = {},
): Promise<KiwifySalesResult> {
  const searchParams: Record<string, string | number | null | undefined> = {
    status: filters.status,
    start_date: filters.startDate,
    end_date: filters.endDate,
    updated_at_start_date: filters.updatedAtStartDate,
    updated_at_end_date: filters.updatedAtEndDate,
    product_id: filters.productId,
    affiliate_id: filters.affiliateId,
    page_number: filters.page,
    page_size: filters.perPage,
    view_full_sale_details:
      filters.viewFullSaleDetails === undefined
        ? undefined
        : filters.viewFullSaleDetails
          ? "true"
          : "false",
  };

  const { ok, payload, error } = await kiwifyRequest("v1/sales", {
    searchParams,
  });

  const listPayload = isRecord(payload)
    ? payload.data ??
      payload.items ??
      payload.results ??
      payload.records ??
      payload.sales ??
      payload.entries
    : payload;

  const sales = ensureArray(listPayload)
    .map((entry) => (isRecord(entry) ? entry : null))
    .filter((entry): entry is UnknownRecord => entry !== null)
    .map((record) => mapSaleSummary(record));

  const pagination = mapSalesPagination(
    isRecord(payload) ? payload.pagination ?? payload.meta ?? null : null,
  );

  return {
    sales,
    pagination,
    raw: payload,
    error: ok ? undefined : error,
  };
}

export async function getKiwifySale(
  id: string,
): Promise<KiwifySaleDetailResult> {
  if (!id) {
    return {
      sale: null,
      raw: null,
      error: "O identificador da venda é obrigatório.",
    };
  }

  const { ok, payload, error } = await kiwifyRequest(
    `v1/sales/${encodeURIComponent(id)}`,
  );

  if (!isRecord(payload)) {
    return { sale: null, raw: payload, error: ok ? undefined : error };
  }

  const summary = mapSaleSummary(payload);

  const shippingPayload = getValueAtPath(payload, "shipping");
  const revenuePartnerPayload = ensureArray(
    getValueAtPath(payload, "revenue_partners"),
  );

  const sale: KiwifySaleDetail = {
    ...summary,
    totalAmount:
      extractNumber(payload, [
        "total_amount",
        "amount",
        "totals.total",
        "summary.total",
      ]) ?? summary.grossAmount ?? summary.netAmount,
    boletoUrl:
      extractString(payload, ["boleto_url", "payment.boleto_url"]) ?? null,
    pixKey:
      extractString(payload, [
        "pix_key",
        "pixKey",
        "payment.pix_key",
        "payment.pixKey",
      ]) ?? null,
    pixQrCode:
      extractString(payload, [
        "pix_qr_code",
        "pixQrCode",
        "payment.pix_qr_code",
        "payment.pixQrCode",
      ]) ?? null,
    cardLastDigits:
      extractString(payload, [
        "card_last_digits",
        "payment.card_last_digits",
      ]) ?? null,
    cardBrand:
      extractString(payload, ["card_brand", "payment.card_brand"]) ?? null,
    affiliate: {
      id:
        extractString(payload, [
          "affiliate_id",
          "affiliate.id",
          "affiliateId",
        ]) ?? null,
      name:
        extractString(payload, [
          "affiliate.name",
          "affiliate_name",
          "affiliateName",
        ]) ?? null,
      email:
        extractString(payload, [
          "affiliate.email",
          "affiliate_email",
          "affiliateEmail",
        ]) ?? null,
    },
    shipping: {
      id: extractString(shippingPayload, ["id", "shipping_id"]) ?? null,
      name:
        extractString(shippingPayload, [
          "name",
          "title",
          "shipping_name",
        ]) ?? null,
      price: extractNumber(shippingPayload, ["price", "amount"]) ?? null,
    },
    revenuePartners: revenuePartnerPayload
      .map((partner) =>
        isRecord(partner)
          ? {
              accountId:
                extractString(partner, [
                  "account_id",
                  "accountId",
                  "id",
                ]) ?? null,
              legalName:
                extractString(partner, [
                  "legal_name",
                  "name",
                  "display_name",
                ]) ?? null,
              documentId:
                extractString(partner, [
                  "document_id",
                  "document",
                  "tax_id",
                ]) ?? null,
              percentage:
                extractNumber(partner, ["percentage", "percent"]) ?? null,
              amount: extractNumber(partner, ["amount", "value"]) ?? null,
              role: extractString(partner, ["role", "type"]) ?? null,
            }
          : null,
      )
      .filter((partner): partner is KiwifyRevenuePartner => partner !== null),
  } satisfies KiwifySaleDetail;

  return { sale, raw: payload, error: ok ? undefined : error };
}

export interface KiwifyRefundOptions {
  pixKey?: string | null;
}

export interface KiwifyRefundResult {
  refunded: boolean;
  raw: unknown;
  status: number;
  error?: string;
}

export async function refundKiwifySale(
  id: string,
  options: KiwifyRefundOptions = {},
): Promise<KiwifyRefundResult> {
  if (!id) {
    return {
      refunded: false,
      raw: null,
      status: 0,
      error: "O identificador da venda é obrigatório.",
    };
  }

  const body: Record<string, unknown> = {};
  if (options.pixKey) {
    body.pixKey = options.pixKey;
  }

  const { ok, payload, status, error } = await kiwifyRequest(
    `v1/sales/${encodeURIComponent(id)}/refund`,
    {
      init: {
        method: "POST",
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      },
    },
  );

  const refunded = ok
    ? coerceBoolean(getValueAtPath(payload, "refunded")) ?? false
    : false;

  return {
    refunded,
    raw: payload,
    status,
    error: ok ? undefined : error,
  };
}

export async function getSalesStatistics(
  filters: SalesStatisticsFilters = {},
): Promise<SalesStatisticsResult> {
  const { startDate, endDate, groupBy } = filters;

  const parsedEndDate = parseDateInput(endDate);
  const resolvedEndDate = parsedEndDate ?? new Date();

  const parsedStartDate = parseDateInput(startDate);
  const resolvedStartDate = parsedStartDate ?? new Date(resolvedEndDate);

  if (!parsedStartDate) {
    resolvedStartDate.setDate(resolvedStartDate.getDate() - 29);
  }

  const baseSearchParams = {
    start_date: formatAsDateParam(resolvedStartDate),
    end_date: formatAsDateParam(resolvedEndDate),
  };

  const statsResult = await kiwifyRequest("v1/stats", {
    searchParams: baseSearchParams,
  });

  const { ok, payload, error } = statsResult;

  const summary = SALES_SUMMARY_PATHS.map((paths) => getValueAtPath(payload, paths.join(".")))
    .map((candidate) => (isRecord(candidate) ? candidate : null))
    .find((candidate) => candidate);

  const totals: SalesStatisticsTotals = { ...DEFAULT_SALES_TOTALS };

  totals.grossAmount = extractNumber(summary ?? payload, [
    "gross_amount",
    "grossAmount",
    "gross",
    "total_gross",
    "total_gross_amount",
    "totals.gross_amount",
    "totals.gross",
  ]) ?? 0;

  totals.netAmount = extractNumber(summary ?? payload, [
    "net_amount",
    "netAmount",
    "net",
    "total_net",
    "total_net_amount",
    "totals.net_amount",
    "totals.net",
  ]) ?? totals.netAmount;

  totals.totalOrders =
    extractNumber(summary ?? payload, [
      "total_orders",
      "total_sales",
      "salesCount",
      "orders",
      "count",
      "quantity",
      "metrics.total_orders",
      "totals.total_sales",
    ])?.valueOf() ?? totals.totalOrders;

  totals.kiwifyCommission =
    extractNumber(summary ?? payload, [
      "kiwify_commission",
      "total_kiwify_commission",
      "commissions.kiwify",
      "commission.kiwify",
      "commission.kiwify_total",
    ]) ?? totals.kiwifyCommission;

  totals.affiliateCommission =
    extractNumber(summary ?? payload, [
      "affiliate_commission",
      "total_affiliate_commission",
      "commissions.affiliate",
      "commission.affiliate",
      "commission.affiliate_total",
    ]) ?? totals.affiliateCommission;

  totals.currency =
    extractString(summary ?? payload, [
      "currency",
      "currency_code",
      "currencyCode",
      "default_currency",
      "totals.currency",
      "summary.currency",
    ]) ?? totals.currency;

  if (totals.totalOrders > 0 && totals.netAmount > 0) {
    totals.averageTicket = totals.netAmount / totals.totalOrders;
  }

  let breakdown: SalesStatisticsBreakdownItem[] = [];
  let salesPayload: unknown;
  let combinedError = ok ? undefined : error;

  if (groupBy === "day" || groupBy === "month") {
    const salesResult = await kiwifyRequest("v1/sales", {
      searchParams: baseSearchParams,
    });

    salesPayload = salesResult.payload;

    if (salesResult.ok) {
      breakdown = buildTimelineFromSales(salesResult.payload, groupBy, totals.currency);
    } else if (!combinedError) {
      combinedError = salesResult.error;
    }
  }

  return {
    totals,
    breakdown,
    raw: { stats: payload, sales: salesPayload },
    error: combinedError,
  };
}

export interface KiwifyProductSummary {
  id: string | null;
  name: string | null;
  description: string | null;
  status: string | null;
  isPublished: boolean | null;
  price: number | null;
  currency: string | null;
  averageTicket: number | null;
  totalSales: number | null;
  imageUrl: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  tags: string[];
  raw: UnknownRecord | null;
}

export interface ProductsResult {
  products: KiwifyProductSummary[];
  raw: unknown;
  error?: string;
}

export async function getKiwifyProducts(): Promise<ProductsResult> {
  const { ok, payload, error } = await kiwifyRequest("v1/products");

  const rawItems = ensureArray(payload);
  const products = rawItems
    .filter((item): item is UnknownRecord => isRecord(item))
    .map((record) => {
      const id =
        extractString(record, [
          "id",
          "uuid",
          "product_id",
          "external_id",
        ]) ?? null;
      const name =
        extractString(record, ["name", "title", "product_name", "display_name"]) ?? null;
      const description =
        extractString(record, ["description", "summary", "about", "details"]) ?? null;
      const status =
        extractString(record, ["status", "state", "availability", "lifecycle_state"]) ?? null;
      const isPublished =
        extractBoolean(record, [
          "is_published",
          "published",
          "active",
          "enabled",
          "isActive",
          "is_public",
        ]);
      const isHidden =
        extractBoolean(record, [
          "is_hidden",
          "hidden",
        ]);
      let price = extractNumber(record, [
        "price",
        "default_price",
        "price.amount",
        "pricing.price",
      ]);

      if (price === null) {
        const cents = extractNumber(record, ["price_cents", "priceCents", "pricing.price_cents"]);
        price = normalizeCentsAmount(cents);
      }

      if (price === null) {
        const defaultOffer =
          record.default_offer ??
          record.defaultOffer ??
          record.default_offering ??
          record.defaultOffering ??
          null;
        price = extractPriceFromOffer(defaultOffer);
      }

      if (price === null) {
        const offersSource =
          record.offers ??
          record.available_offers ??
          record.availableOffers ??
          record.offer_options ??
          record.offerOptions ??
          null;
        for (const offer of ensureArray(offersSource)) {
          const offerPrice = extractPriceFromOffer(offer);
          if (offerPrice !== null) {
            price = offerPrice;
            break;
          }
        }
      }

      const currency =
        extractString(record, [
          "currency",
          "currency_code",
          "price.currency",
          "pricing.currency",
        ]) ?? null;

      let averageTicket = extractNumber(record, [
        "average_ticket",
        "metrics.average_ticket",
        "analytics.average_ticket",
      ]);
      if (averageTicket === null) {
        const cents = extractNumber(record, [
          "average_ticket_cents",
          "metrics.average_ticket_cents",
        ]);
        if (cents !== null) {
          averageTicket = cents / 100;
        }
      }

      const totalSales = extractNumber(record, [
        "total_sales",
        "metrics.total_sales",
        "analytics.total_sales",
        "sales_count",
        "orders",
      ]);

      const imageUrl =
        extractString(record, [
          "image",
          "image_url",
          "thumbnail",
          "cover",
          "media.thumbnail",
        ]) ?? null;

      const updatedAt =
        extractString(record, ["updated_at", "updatedAt", "updated_at_iso", "modified_at"]) ??
        null;
      const createdAt =
        extractString(record, ["created_at", "createdAt", "created_at_iso"]) ?? null;

      const tags = extractStringArray(record, ["tags", "categories", "labels"]);

      return {
        id,
        name,
        description,
        status,
        isPublished: isPublished ?? (isHidden === null ? null : !isHidden),
        price,
        currency,
        averageTicket,
        totalSales,
        imageUrl,
        updatedAt,
        createdAt,
        tags,
        raw: record,
      } satisfies KiwifyProductSummary;
    });

  return { products, raw: payload, error: ok ? undefined : error };
}

export interface KiwifySubscriptionSummary {
  id: string | null;
  status: string | null;
  productName: string | null;
  planName: string | null;
  customerName: string | null;
  customerEmail: string | null;
  amount: number | null;
  currency: string | null;
  nextChargeAt: string | null;
  lastChargeAt: string | null;
  createdAt: string | null;
  raw: UnknownRecord | null;
}

export interface SubscriptionsResult {
  subscriptions: KiwifySubscriptionSummary[];
  raw: unknown;
  error?: string;
}

export async function getKiwifySubscriptions(): Promise<SubscriptionsResult> {
  const { ok, payload, error } = await kiwifyRequest("api/v1/subscriptions");

  const items = ensureArray(payload)
    .map((item) => (isRecord(item) ? item : null))
    .filter((item): item is UnknownRecord => item !== null)
    .map((record) => {
      const id =
        extractString(record, ["id", "subscription_id", "uuid", "external_id"]) ?? null;
      const status =
        extractString(record, ["status", "state", "subscription_status", "lifecycle_state"]) ??
        null;
      const productName =
        extractString(record, [
          "product_name",
          "product.name",
          "plan.product_name",
          "plan.product.name",
        ]) ?? null;
      const planName =
        extractString(record, ["plan_name", "plan.name", "offer", "offer_name"]) ?? null;
      const customerName =
        extractString(record, ["customer_name", "customer.name", "buyer_name"]) ?? null;
      const customerEmail =
        extractString(record, ["customer_email", "customer.email", "buyer_email"]) ?? null;

      let amount = extractNumber(record, [
        "price",
        "amount",
        "plan.price",
        "billing.price",
        "billing_amount",
      ]);
      if (amount === null) {
        const cents = extractNumber(record, ["price_cents", "amount_cents", "plan.price_cents"]);
        if (cents !== null) {
          amount = cents / 100;
        }
      }

      const currency =
        extractString(record, [
          "currency",
          "currency_code",
          "plan.currency",
          "billing.currency",
        ]) ?? null;

      const nextChargeAt =
        extractString(record, [
          "next_charge_at",
          "next_charge_date",
          "next_billing_at",
          "next_payment_at",
        ]) ?? null;

      const lastChargeAt =
        extractString(record, [
          "last_charge_at",
          "last_charge_date",
          "last_payment_at",
          "last_billing_at",
        ]) ?? null;

      const createdAt =
        extractString(record, ["created_at", "createdAt", "created_at_iso", "started_at"]) ??
        null;

      return {
        id,
        status,
        productName,
        planName,
        customerName,
        customerEmail,
        amount,
        currency,
        nextChargeAt,
        lastChargeAt,
        createdAt,
        raw: record,
      } satisfies KiwifySubscriptionSummary;
    });

  return { subscriptions: items, raw: payload, error: ok ? undefined : error };
}

export interface KiwifyEnrollmentSummary {
  id: string | null;
  courseName: string | null;
  studentName: string | null;
  studentEmail: string | null;
  progress: number | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  raw: UnknownRecord | null;
}

export interface EnrollmentsResult {
  enrollments: KiwifyEnrollmentSummary[];
  raw: unknown;
  error?: string;
}

export async function getKiwifyEnrollments(): Promise<EnrollmentsResult> {
  const { ok, payload, error } = await kiwifyRequest("api/v1/enrollments");

  const items = ensureArray(payload)
    .map((item) => (isRecord(item) ? item : null))
    .filter((item): item is UnknownRecord => item !== null)
    .map((record) => {
      const id = extractString(record, ["id", "enrollment_id", "uuid", "external_id"]) ?? null;
      const courseName =
        extractString(record, ["course_name", "course.name", "product_name", "course"]) ?? null;
      const studentName =
        extractString(record, ["student_name", "student.name", "customer_name", "buyer_name"]) ??
        null;
      const studentEmail =
        extractString(record, ["student_email", "student.email", "customer_email", "buyer_email"]) ??
        null;

      let progress = extractNumber(record, ["progress", "percentage", "progress_percent"]);
      if (progress !== null && progress > 1 && progress <= 100) {
        progress = Math.round(progress);
      }

      const lastActivityAt =
        extractString(record, ["last_activity_at", "last_access_at", "last_seen_at"]) ?? null;
      const createdAt =
        extractString(record, ["created_at", "createdAt", "created_at_iso", "started_at"]) ??
        null;

      return {
        id,
        courseName,
        studentName,
        studentEmail,
        progress,
        lastActivityAt,
        createdAt,
        raw: record,
      } satisfies KiwifyEnrollmentSummary;
    });

  return { enrollments: items, raw: payload, error: ok ? undefined : error };
}

export interface PixelEventSummary {
  id: string | null;
  eventName: string | null;
  pixelId: string | null;
  occurredAt: string | null;
  amount: number | null;
  currency: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  raw: UnknownRecord | null;
}

export interface PixelEventsResult {
  events: PixelEventSummary[];
  totalAmount: number;
  currency: string | null;
  raw: unknown;
  error?: string;
}

export async function getPixelEvents(): Promise<PixelEventsResult> {
  const { ok, payload, error } = await kiwifyRequest("api/v1/pixel/events");

  const events = ensureArray(payload)
    .map((item) => (isRecord(item) ? item : null))
    .filter((item): item is UnknownRecord => item !== null)
    .map((record) => {
      let amount = extractNumber(record, [
        "amount",
        "value",
        "revenue",
        "event_value",
        "purchase_value",
      ]);
      if (amount === null) {
        const cents = extractNumber(record, ["amount_cents", "value_cents"]);
        if (cents !== null) {
          amount = cents / 100;
        }
      }

      const currency =
        extractString(record, ["currency", "currency_code", "currencyCode"]) ?? null;

      return {
        id: extractString(record, ["id", "event_id", "uuid"]) ?? null,
        eventName:
          extractString(record, [
            "event_name",
            "name",
            "type",
            "pixel_event",
          ]) ?? null,
        pixelId: extractString(record, ["pixel_id", "pixelId"]) ?? null,
        occurredAt:
          extractString(record, ["occurred_at", "created_at", "event_time", "timestamp"]) ??
          null,
        amount,
        currency,
        utmSource:
          extractString(record, ["utm_source", "utmSource", "traffic.utm_source"]) ?? null,
        utmMedium:
          extractString(record, ["utm_medium", "utmMedium", "traffic.utm_medium"]) ?? null,
        utmCampaign:
          extractString(record, ["utm_campaign", "utmCampaign", "traffic.utm_campaign"]) ??
          null,
        source: extractString(record, ["source", "traffic.source"]) ?? null,
        medium: extractString(record, ["medium", "traffic.medium"]) ?? null,
        campaign: extractString(record, ["campaign", "traffic.campaign"]) ?? null,
        raw: record,
      } satisfies PixelEventSummary;
    })
    .sort((a, b) => {
      const dateA = a.occurredAt ? Date.parse(a.occurredAt) : 0;
      const dateB = b.occurredAt ? Date.parse(b.occurredAt) : 0;
      return dateB - dateA;
    });

  const totalAmount = events.reduce((acc, item) => acc + (item.amount ?? 0), 0);
  const currency = events.find((event) => event.currency)?.currency ?? null;

  return { events, totalAmount, currency, raw: payload, error: ok ? undefined : error };
}
