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
    const url = new URL(path.replace(/^\//, ""), base);

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

    if (!params.has("account_id")) {
      params.set("account_id", env.KIWIFY_API_ACCOUNT_ID);
    }

    for (const [key, value] of params.entries()) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers(init?.headers ?? {});
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${env.KIWIFY_API_TOKEN}`);
    }
    headers.set("Accept", "application/json");
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!headers.has("X-Account-Id")) {
      headers.set("X-Account-Id", env.KIWIFY_API_ACCOUNT_ID);
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
      const message =
        (isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : undefined) ??
        `Erro ${status} ao consultar a API da Kiwify.`;
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

const BREAKDOWN_PATHS: StringArray[] = [
  ["series"],
  ["breakdown"],
  ["grouped"],
  ["groups"],
  ["data"],
  ["items"],
  [],
];

export interface SalesStatisticsFilters {
  startDate?: string;
  endDate?: string;
  groupBy?: "day" | "month" | "product" | "source";
}

export async function getSalesStatistics(
  filters: SalesStatisticsFilters = {},
): Promise<SalesStatisticsResult> {
  const { startDate, endDate, groupBy } = filters;
  const { ok, payload, error } = await kiwifyRequest("api/v1/statistics/my-sales", {
    searchParams: {
      start_date: startDate,
      end_date: endDate,
      group_by: groupBy,
    },
  });

  const summary = SALES_SUMMARY_PATHS.map((paths) => getValueAtPath(payload, paths.join(".")))
    .map((candidate) => (isRecord(candidate) ? candidate : null))
    .find((candidate) => candidate);

  const totals: SalesStatisticsTotals = { ...DEFAULT_SALES_TOTALS };

  totals.grossAmount = extractNumber(summary ?? payload, [
    "gross_amount",
    "grossAmount",
    "gross",
    "total_gross",
    "totals.gross_amount",
    "totals.gross",
  ]) ?? 0;

  totals.netAmount = extractNumber(summary ?? payload, [
    "net_amount",
    "netAmount",
    "net",
    "total_net",
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
    ])?.valueOf() ?? totals.totalOrders;

  totals.kiwifyCommission =
    extractNumber(summary ?? payload, [
      "kiwify_commission",
      "commissions.kiwify",
      "commission.kiwify",
      "commission.kiwify_total",
    ]) ?? totals.kiwifyCommission;

  totals.affiliateCommission =
    extractNumber(summary ?? payload, [
      "affiliate_commission",
      "commissions.affiliate",
      "commission.affiliate",
      "commission.affiliate_total",
    ]) ?? totals.affiliateCommission;

  totals.currency =
    extractString(summary ?? payload, [
      "currency",
      "currency_code",
      "currencyCode",
      "totals.currency",
      "summary.currency",
    ]) ?? totals.currency;

  if (totals.totalOrders > 0 && totals.netAmount > 0) {
    totals.averageTicket = totals.netAmount / totals.totalOrders;
  }

  const breakdownSource = BREAKDOWN_PATHS.map((paths) => getValueAtPath(payload, paths.join(".")))
    .map((candidate) => ensureArray(candidate))
    .find((candidate) => candidate.length > 0);

  const breakdown = (breakdownSource ?? [])
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const currency =
        extractString(entry, ["currency", "currency_code", "currencyCode"]) ?? totals.currency;
      let grossAmount = extractNumber(entry, [
        "gross_amount",
        "grossAmount",
        "gross",
        "totals.gross",
        "amount.gross",
      ]);

      if (grossAmount === null) {
        const cents = extractNumber(entry, ["gross_cents", "grossAmountCents", "gross.amount"]);
        if (cents !== null) {
          grossAmount = cents / 100;
        }
      }

      let netAmount = extractNumber(entry, [
        "net_amount",
        "netAmount",
        "net",
        "totals.net",
        "amount.net",
      ]);

      if (netAmount === null) {
        const cents = extractNumber(entry, ["net_cents", "netAmountCents", "net.amount"]);
        if (cents !== null) {
          netAmount = cents / 100;
        }
      }

      const orders = extractNumber(entry, [
        "orders",
        "count",
        "sales",
        "quantity",
        "total_sales",
      ]);

      const label =
        extractString(entry, [
          "label",
          "date",
          "period",
          "name",
          "group",
          "product",
        ]) ?? "—";

      return {
        label,
        grossAmount,
        netAmount,
        orders,
        currency,
      } satisfies SalesStatisticsBreakdownItem;
    })
    .filter((item): item is SalesStatisticsBreakdownItem => item !== null);

  return {
    totals,
    breakdown,
    raw: payload,
    error,
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
  const { ok, payload, error } = await kiwifyRequest("api/v1/products");

  const rawItems = ensureArray(payload);
  const products = rawItems
    .map((item) => (isRecord(item) ? item : null))
    .map((record) => {
      if (!record) return null;

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
        ]);
      let price = extractNumber(record, [
        "price",
        "default_price",
        "price.amount",
        "pricing.price",
      ]);

      if (price === null) {
        const cents = extractNumber(record, ["price_cents", "priceCents", "pricing.price_cents"]);
        if (cents !== null) {
          price = cents / 100;
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
        isPublished,
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
    })
    .filter((item): item is KiwifyProductSummary => item !== null);

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
