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
  if (!hasSupabaseConfig()) {
    return {
      records: [],
      totalCount: 0,
      totalAmount: 0,
      lastEvent: null,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error, count } = await supabase
    .from("approved_sales")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao buscar vendas aprovadas", error);
    throw error;
  }

  const totalAmount = data?.reduce((sum, item) => sum + toNumber(item.amount), 0) ?? 0;
  const lastEvent = data?.[0]?.occurred_at ?? data?.[0]?.created_at ?? null;

  return {
    records: (data ?? []) as ApprovedSale[],
    totalCount: count ?? 0,
    totalAmount,
    lastEvent,
  };
}

export async function getAbandonedCarts(limit = 40) {
  if (!hasSupabaseConfig()) {
    return {
      records: [],
      totalCount: 0,
      potentialAmount: 0,
      lastEvent: null,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error, count } = await supabase
    .from("abandoned_carts")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao buscar carrinhos abandonados", error);
    throw error;
  }

  const potentialAmount = data?.reduce((sum, item) => sum + toNumber(item.amount), 0) ?? 0;
  const lastEvent = data?.[0]?.occurred_at ?? data?.[0]?.created_at ?? null;

  return {
    records: (data ?? []) as AbandonedCart[],
    totalCount: count ?? 0,
    potentialAmount,
    lastEvent,
  };
}

export async function getRefundedSales(limit = 40) {
  if (!hasSupabaseConfig()) {
    return {
      records: [],
      totalCount: 0,
      totalAmount: 0,
      lastEvent: null,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error, count } = await supabase
    .from("refunded_sales")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao buscar vendas reembolsadas", error);
    throw error;
  }

  const totalAmount = data?.reduce((sum, item) => sum + toNumber(item.amount), 0) ?? 0;
  const lastEvent = data?.[0]?.occurred_at ?? data?.[0]?.created_at ?? null;

  return {
    records: (data ?? []) as RefundedSale[],
    totalCount: count ?? 0,
    totalAmount,
    lastEvent,
  };
}

export async function getRejectedPayments(limit = 40) {
  if (!hasSupabaseConfig()) {
    return {
      records: [],
      totalCount: 0,
      totalAmount: 0,
      lastEvent: null,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error, count } = await supabase
    .from("rejected_payments")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao buscar pagamentos recusados", error);
    throw error;
  }

  const totalAmount = data?.reduce((sum, item) => sum + toNumber(item.amount), 0) ?? 0;
  const lastEvent = data?.[0]?.occurred_at ?? data?.[0]?.created_at ?? null;

  return {
    records: (data ?? []) as RejectedPayment[],
    totalCount: count ?? 0,
    totalAmount,
    lastEvent,
  };
}

export async function getPendingPayments(limit = 40) {
  if (!hasSupabaseConfig()) {
    return {
      records: [],
      totalCount: 0,
      totalAmount: 0,
      lastEvent: null,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error, count } = await supabase
    .from("pending_payments")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao buscar pagamentos pendentes", error);
    throw error;
  }

  const totalAmount = data?.reduce((sum, item) => sum + toNumber(item.amount), 0) ?? 0;
  const lastEvent = data?.[0]?.occurred_at ?? data?.[0]?.created_at ?? null;

  return {
    records: (data ?? []) as PendingPayment[],
    totalCount: count ?? 0,
    totalAmount,
    lastEvent,
  };
}

const toNumber = (value: Numeric) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
