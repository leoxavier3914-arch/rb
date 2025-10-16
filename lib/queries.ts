import { getSupabaseAdmin, hasSupabaseConfig } from "./supabase";

type Numeric = number | string | null;

interface SaleEventBase {
  id: string;
  sale_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_name: string | null;
  amount: Numeric;
  currency: string | null;
  payment_method: string | null;
  occurred_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

type AmountCarrier = Pick<SaleEventBase, "amount" | "occurred_at" | "created_at">;

interface EventQueryResult<T> {
  records: T[];
  totalCount: number;
  sum: number;
  lastEvent: string | null;
}

const buildEmptyResult = <T>(): EventQueryResult<T> => ({
  records: [],
  totalCount: 0,
  sum: 0,
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
  const sum = records.reduce((acc, item) => acc + toNumber(item.amount), 0);
  const lastEvent = records[0]?.occurred_at ?? records[0]?.created_at ?? null;

  return {
    records,
    totalCount: count ?? 0,
    sum,
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
  currency: string | null;
  checkout_url: string | null;
  status: string | null;
  occurred_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function getApprovedSales(limit = 40) {
  const { sum, ...result } = await fetchEvents<ApprovedSale>({
    table: "approved_sales",
    limit,
    logContext: "vendas aprovadas",
  });

  return {
    ...result,
    totalAmount: sum,
  };
}

export async function getAbandonedCarts(limit = 40) {
  const { sum, ...result } = await fetchEvents<AbandonedCart>({
    table: "abandoned_carts",
    limit,
    logContext: "carrinhos abandonados",
  });

  return {
    ...result,
    potentialAmount: sum,
  };
}

export async function getRefundedSales(limit = 40) {
  const { sum, ...result } = await fetchEvents<RefundedSale>({
    table: "refunded_sales",
    limit,
    logContext: "vendas reembolsadas",
  });

  return {
    ...result,
    totalAmount: sum,
  };
}

export async function getRejectedPayments(limit = 40) {
  const { sum, ...result } = await fetchEvents<RejectedPayment>({
    table: "rejected_payments",
    limit,
    logContext: "pagamentos recusados",
  });

  return {
    ...result,
    totalAmount: sum,
  };
}

export async function getPendingPayments(limit = 40) {
  const { sum, ...result } = await fetchEvents<PendingPayment>({
    table: "pending_payments",
    limit,
    logContext: "pagamentos pendentes",
  });

  return {
    ...result,
    totalAmount: sum,
  };
}

const toNumber = (value: Numeric) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
