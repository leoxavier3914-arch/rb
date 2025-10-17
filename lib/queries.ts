import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";

type Numeric = number | string | null;

interface SaleEventBase {
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

const fetchEvents = async <T extends AmountCarrier>({
  table,
  limit = 40,
  logContext,
}: {
  table: string;
  limit?: number;
  logContext: string;
}): Promise<EventQueryResult<T>> => {
  if (!hasSupabaseConfig()) {
    return buildEmptyResult<T>();
  }

  const supabase = getSupabaseAdmin();
  const { data, error, count } = await supabase
    .from(table)
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

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
  const lastEvent = records[0]?.occurred_at ?? records[0]?.created_at ?? null;

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

export async function getApprovedSales(limit = 40) {
  const { totals, ...result } = await fetchEvents<ApprovedSale>({
    table: "approved_sales",
    limit,
    logContext: "vendas aprovadas",
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

export async function getAbandonedCarts(limit = 40) {
  const { totals, ...result } = await fetchEvents<AbandonedCart>({
    table: "abandoned_carts",
    limit,
    logContext: "carrinhos abandonados",
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

export async function getRefundedSales(limit = 40) {
  const { totals, ...result } = await fetchEvents<RefundedSale>({
    table: "refunded_sales",
    limit,
    logContext: "vendas reembolsadas",
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

export async function getRejectedPayments(limit = 40) {
  const { totals, ...result } = await fetchEvents<RejectedPayment>({
    table: "rejected_payments",
    limit,
    logContext: "pagamentos recusados",
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

export async function getPendingPayments(limit = 40) {
  const { totals, ...result } = await fetchEvents<PendingPayment>({
    table: "pending_payments",
    limit,
    logContext: "pagamentos pendentes",
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

interface SaleDetailsResult {
  saleId: string;
  primary: SaleDetailRecord;
  entries: SaleDetailRecord[];
}

const resolveEventTimestamp = (event: SaleEventBase) => {
  const candidate = event.occurred_at ?? event.created_at;
  if (!candidate) {
    return 0;
  }

  const parsed = new Date(candidate);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
};

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
        .select("*")
        .eq("sale_id", saleId)
        .order("occurred_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Erro ao buscar detalhes da venda (${source.table})`, error);
        throw error;
      }

      const rows = (data ?? []) as SaleEventBase[];
      const record = rows[0];
      if (!record) {
        return null;
      }

      return {
        ...(record as SaleEventBase),
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
