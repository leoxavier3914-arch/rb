import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";

type Numeric = number | string | null;

export interface SaleEventBase {
  id: string;
  sale_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_name: string | null;
  amount: Numeric;
  gross_amount: Numeric;
  net_amount: Numeric;
  kiwify_commission_amount: Numeric;
  affiliate_commission_amount: Numeric;
  currency: string | null;
  payment_method: string | null;
  status: string | null;
  role: string | null;
  customer_phone: string | null;
  customer_document: string | null;
  customer_ip: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  occurred_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

type AmountCarrier = Pick<
  SaleEventBase,
  |
    "amount"
    | "gross_amount"
    | "net_amount"
    | "kiwify_commission_amount"
  | "affiliate_commission_amount"
  | "occurred_at"
  | "created_at"
>;

const resolveEventTimestamp = (
  event: Pick<SaleEventBase, "occurred_at" | "created_at">,
) => {
  const candidate = event.occurred_at ?? event.created_at;
  if (!candidate) {
    return Number.MIN_SAFE_INTEGER;
  }

  const parsed = new Date(candidate);
  const time = parsed.getTime();
  return Number.isNaN(time) ? Number.MIN_SAFE_INTEGER : time;
};

interface EventQueryResult<T> {
  records: T[];
  totalCount: number;
  totals: EventTotals;
  lastEvent: string | null;
}

interface EventTotals {
  amount: number;
  netAmount: number;
  grossAmount: number;
  kiwifyCommissionAmount: number;
  affiliateCommissionAmount: number;
}

const emptyTotals: EventTotals = {
  amount: 0,
  netAmount: 0,
  grossAmount: 0,
  kiwifyCommissionAmount: 0,
  affiliateCommissionAmount: 0,
};

const buildEmptyResult = <T>(): EventQueryResult<T> => ({
  records: [],
  totalCount: 0,
  totals: { ...emptyTotals },
  lastEvent: null,
});

export interface EventFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
}

interface FetchEventsOptions {
  table: string;
  limit?: number;
  logContext: string;
  filters?: EventFilters;
  searchableColumns?: string[];
}

const DEFAULT_SEARCHABLE_COLUMNS = [
  "customer_name",
  "product_name",
  "customer_email",
  "customer_phone",
];

const escapeLikePattern = (value: string) => value.replace(/[%_]/g, (match) => `\\${match}`);

const fetchEvents = async <T extends AmountCarrier>({
  table,
  limit = 40,
  logContext,
  filters,
  searchableColumns = DEFAULT_SEARCHABLE_COLUMNS,
}: FetchEventsOptions): Promise<EventQueryResult<T>> => {
  if (!hasSupabaseConfig()) {
    return buildEmptyResult<T>();
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from(table)
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate);
  }

  const searchTerm = filters?.search?.trim();
  if (searchTerm && searchableColumns.length > 0) {
    const escaped = escapeLikePattern(searchTerm);
    const ilikePattern = `%${escaped}%`;
    const conditions = searchableColumns
      .map((column) => `${column}.ilike.${ilikePattern}`)
      .join(",");

    query = query.or(conditions);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error(`Erro ao buscar ${logContext}`, error);
    throw error;
  }

  const records = (data ?? []) as T[];
  const totals = records.reduce<EventTotals>(
    (acc, item) => ({
      amount: acc.amount + toNumber(item.amount),
      netAmount: acc.netAmount + toNumber(item.net_amount ?? item.amount),
      grossAmount: acc.grossAmount + toNumber(item.gross_amount ?? item.amount),
      kiwifyCommissionAmount:
        acc.kiwifyCommissionAmount + toNumber(item.kiwify_commission_amount),
      affiliateCommissionAmount:
        acc.affiliateCommissionAmount + toNumber(item.affiliate_commission_amount),
    }),
    { ...emptyTotals },
  );

  let latestRecord: T | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const record of records) {
    const timestamp = resolveEventTimestamp(record);
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestRecord = record;
    }
  }

  const lastEvent = latestRecord
    ? latestRecord.occurred_at ?? latestRecord.created_at ?? null
    : null;

  return {
    records,
    totalCount: count ?? 0,
    totals,
    lastEvent,
  };
};

export interface ApprovedSale extends SaleEventBase {}

export interface RefundedSale extends SaleEventBase {}

export interface RejectedPayment extends SaleEventBase {}

export interface PendingPayment extends SaleEventBase {}

export interface AbandonedCart {
  id: string;
  event_reference: string;
  cart_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_name: string | null;
  amount: Numeric;
  gross_amount: Numeric;
  net_amount: Numeric;
  kiwify_commission_amount: Numeric;
  affiliate_commission_amount: Numeric;
  currency: string | null;
  checkout_url: string | null;
  status: string | null;
  occurred_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function getApprovedSales({
  limit = 40,
  filters,
}: { limit?: number; filters?: EventFilters } = {}) {
  const { totals, ...result } = await fetchEvents<ApprovedSale>({
    table: "approved_sales",
    limit,
    logContext: "vendas aprovadas",
    filters,
  });

  return {
    ...result,
    totals,
    totalAmount: totals.netAmount,
    totalGrossAmount: totals.grossAmount,
    totalKiwifyCommissionAmount: totals.kiwifyCommissionAmount,
    totalAffiliateCommissionAmount: totals.affiliateCommissionAmount,
  };
}

export async function getAbandonedCarts({
  limit = 40,
  filters,
}: { limit?: number; filters?: EventFilters } = {}) {
  const { totals, ...result } = await fetchEvents<AbandonedCart>({
    table: "abandoned_carts",
    limit,
    logContext: "carrinhos abandonados",
    filters,
    searchableColumns: ["customer_name", "product_name", "customer_email"],
  });

  return {
    ...result,
    totals,
    potentialAmount: totals.netAmount,
    potentialGrossAmount: totals.grossAmount,
    potentialKiwifyCommissionAmount: totals.kiwifyCommissionAmount,
    potentialAffiliateCommissionAmount: totals.affiliateCommissionAmount,
  };
}

const ABANDONED_CART_DETAIL_COLUMNS = [
  "id",
  "event_reference",
  "cart_id",
  "customer_name",
  "customer_email",
  "product_name",
  "amount",
  "gross_amount",
  "net_amount",
  "kiwify_commission_amount",
  "affiliate_commission_amount",
  "currency",
  "checkout_url",
  "status",
  "occurred_at",
  "payload",
  "created_at",
].join(", ");

export async function getAbandonedCartDetail(
  reference: string,
): Promise<AbandonedCart | null> {
  if (!reference) {
    return null;
  }

  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = getSupabaseAdmin();

  const isAbandonedCartRecord = (value: unknown): value is AbandonedCart =>
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "event_reference" in value;

  const fetchByColumn = async (
    column: string,
  ): Promise<AbandonedCart | null> => {
    const { data, error } = await supabase
      .from("abandoned_carts")
      .select(ABANDONED_CART_DETAIL_COLUMNS)
      .eq(column, reference)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error(`Erro ao buscar detalhes do carrinho (${column})`, error);
      throw error;
    }

    if (!Array.isArray(data)) {
      return null;
    }

    for (const entry of data) {
      if (isAbandonedCartRecord(entry)) {
        return entry;
      }
    }

    return null;
  };

  const byReference = await fetchByColumn("event_reference");
  if (byReference) {
    return byReference;
  }

  if (isUuid(reference)) {
    const byId = await fetchByColumn("id");
    if (byId) {
      return byId;
    }
  }

  const fallbacks = ["cart_id", "checkout_url"];
  for (const column of fallbacks) {
    const record = await fetchByColumn(column);
    if (record) {
      return record;
    }
  }

  return null;
}

export async function getRefundedSales({
  limit = 40,
  filters,
}: { limit?: number; filters?: EventFilters } = {}) {
  const { totals, ...result } = await fetchEvents<RefundedSale>({
    table: "refunded_sales",
    limit,
    logContext: "vendas reembolsadas",
    filters,
  });

  return {
    ...result,
    totals,
    totalAmount: totals.netAmount,
    totalGrossAmount: totals.grossAmount,
    totalKiwifyCommissionAmount: totals.kiwifyCommissionAmount,
    totalAffiliateCommissionAmount: totals.affiliateCommissionAmount,
  };
}

export async function getRejectedPayments({
  limit = 40,
  filters,
}: { limit?: number; filters?: EventFilters } = {}) {
  const { totals, ...result } = await fetchEvents<RejectedPayment>({
    table: "rejected_payments",
    limit,
    logContext: "pagamentos recusados",
    filters,
  });

  return {
    ...result,
    totals,
    totalAmount: totals.netAmount,
    totalGrossAmount: totals.grossAmount,
    totalKiwifyCommissionAmount: totals.kiwifyCommissionAmount,
    totalAffiliateCommissionAmount: totals.affiliateCommissionAmount,
  };
}

export async function getPendingPayments({
  limit = 40,
  filters,
}: { limit?: number; filters?: EventFilters } = {}) {
  const { totals, ...result } = await fetchEvents<PendingPayment>({
    table: "pending_payments",
    limit,
    logContext: "pagamentos pendentes",
    filters,
  });

  return {
    ...result,
    totals,
    totalAmount: totals.netAmount,
    totalGrossAmount: totals.grossAmount,
    totalKiwifyCommissionAmount: totals.kiwifyCommissionAmount,
    totalAffiliateCommissionAmount: totals.affiliateCommissionAmount,
  };
}

const toNumber = (value: Numeric) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const saleSources = [
  { table: "approved_sales", kind: "approved" as const, label: "Venda aprovada" },
  { table: "pending_payments", kind: "pending" as const, label: "Pagamento pendente" },
  { table: "rejected_payments", kind: "rejected" as const, label: "Pagamento recusado" },
  { table: "refunded_sales", kind: "refunded" as const, label: "Venda reembolsada" },
] as const;

type SaleSource = (typeof saleSources)[number];

type SaleDetailRecord =
  | (ApprovedSale & { table: SaleSource["table"]; kind: SaleSource["kind"]; label: string })
  | (PendingPayment & { table: SaleSource["table"]; kind: SaleSource["kind"]; label: string })
  | (RejectedPayment & { table: SaleSource["table"]; kind: SaleSource["kind"]; label: string })
  | (RefundedSale & { table: SaleSource["table"]; kind: SaleSource["kind"]; label: string });

const SALE_DETAIL_SELECT_COLUMNS = [
  "id",
  "sale_id",
  "customer_name",
  "customer_email",
  "product_name",
  "amount",
  "gross_amount",
  "net_amount",
  "kiwify_commission_amount",
  "affiliate_commission_amount",
  "currency",
  "payment_method",
  "status",
  "role",
  "customer_phone",
  "customer_document",
  "customer_ip",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "occurred_at",
  "payload",
  "created_at",
].join(", ");

interface SaleDetailsResult {
  saleId: string;
  primary: SaleDetailRecord;
  entries: SaleDetailRecord[];
}

export async function getSaleDetails(saleId: string): Promise<SaleDetailsResult | null> {
  if (!saleId) {
    return null;
  }

  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = getSupabaseAdmin();

  const results = await Promise.all(
    saleSources.map(async (source): Promise<SaleDetailRecord | null> => {
      const { data, error } = await supabase
        .from(source.table)
        .select(SALE_DETAIL_SELECT_COLUMNS)
        .eq("sale_id", saleId)
        .order("occurred_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Erro ao buscar detalhes da venda (${source.table})`, error);
        throw error;
      }

      const rows = (data ?? []) as unknown as SaleEventBase[];
      const record = rows[0];
      if (!record) {
        return null;
      }

      return {
        ...record,
        table: source.table,
        kind: source.kind,
        label: source.label,
      } as SaleDetailRecord;
    }),
  );

  const entries = results.filter(
    (entry): entry is SaleDetailRecord => entry !== null,
  );

  if (entries.length === 0) {
    return null;
  }

  const sorted = entries
    .slice()
    .sort((a, b) => resolveEventTimestamp(b) - resolveEventTimestamp(a));

  return {
    saleId,
    primary: sorted[0],
    entries: sorted,
  };
}

export type { SaleDetailRecord, SaleDetailsResult };
