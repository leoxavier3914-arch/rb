const candidateKeys = ["data", "items", "results", "sales"] as const;

const splitPath = (path: string) => path.split(".");

export const SALE_ID_PATHS = [
  "sale_id",
  "id",
  "sale.id",
  "data.sale_id",
  "data.id",
] as const;

export const PRODUCT_ID_PATHS = [
  "product_id",
  "product.id",
  "product.product_id",
  "items.0.product.id",
  "items.0.product_id",
  "order.product.id",
  "order.product_id",
  "data.product.id",
  "data.items.0.product.id",
] as const;

export const PRODUCT_NAME_PATHS = [
  "product_name",
  "product.name",
  "product.title",
  "items.0.product.name",
  "items.0.name",
  "offer_name",
  "order.product.name",
  "data.product.name",
  "data.items.0.product.name",
] as const;

export const STATUS_PATHS = [
  "status",
  "data.status",
  "payment.status",
  "order.status",
  "sale.status",
  "sale_status",
  "payment_status",
  "data.payment.status",
] as const;

export const PAYMENT_METHOD_PATHS = [
  "payment_method",
  "payment.method",
  "payment.method_name",
  "payment.methodName",
  "payment.payment_method",
  "order.payment.method",
  "data.payment.method",
] as const;

export const AMOUNT_PATHS = [
  "net_amount",
  "amount",
  "amount_cents",
  "total_amount",
  "payment.amount",
  "pricing.amount",
  "price",
  "items.0.price",
  "data.net_amount",
  "data.amount",
] as const;

export const CREATED_AT_PATHS = [
  "created_at",
  "sale_date",
  "paid_at",
  "order.created_at",
  "data.created_at",
  "data.sale_date",
] as const;

export const UPDATED_AT_PATHS = [
  "updated_at",
  "data.updated_at",
  "order.updated_at",
] as const;

export const NET_AMOUNT_PATHS = [
  "net_amount",
  "net_amount_cents",
  "pricing.net_amount",
  "data.net_amount",
  "payment.net_amount",
] as const;

export const GROSS_AMOUNT_PATHS = [
  "amount",
  "amount_cents",
  "total_amount",
  "payment.amount",
  "pricing.amount",
  "items.0.price",
  "order.amount",
  "data.amount",
] as const;

export const TOTAL_FEE_PATHS = [
  "fees",
  "fee",
  "total_fee",
  "total_fees",
  "total_commission",
  "commission_total",
] as const;

export const SPECIFIC_FEE_PATHS = [
  "commission",
  "commissions",
  "commission_amount",
  "kiwify_fee",
  "kiwify_commission",
  "gateway_fee",
  "gateway_commission",
  "tax",
  "taxes",
] as const;

export const REFUND_STATUS_PATHS = [
  "refund_status",
  "payment.refund_status",
  "order.refund_status",
  "data.refund_status",
] as const;

export const CHARGEBACK_STATUS_PATHS = [
  "chargeback_status",
  "payment.chargeback_status",
  "order.chargeback_status",
] as const;

export const PAYMENT_STATUS_PATHS = [
  "payment_status",
  "payment.status",
  "order.payment_status",
  "order.payment.status",
] as const;

export const BUYER_NAME_PATHS = [
  "buyer.name",
  "buyer.full_name",
  "customer.name",
  "customer.full_name",
  "client.name",
  "client.full_name",
  "payer.name",
  "user.name",
  "lead.name",
  "data.buyer.name",
] as const;

export const BUYER_EMAIL_PATHS = [
  "buyer.email",
  "customer.email",
  "client.email",
  "payer.email",
  "user.email",
  "lead.email",
  "data.buyer.email",
] as const;

export const candidateCollectionKeys = candidateKeys;

export const getNestedValue = (
  payload: Record<string, unknown>,
  path: string,
): unknown => {
  return splitPath(path).reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) {
      return undefined;
    }

    if (Array.isArray(acc)) {
      const index = Number(key);
      if (Number.isInteger(index)) {
        return acc[index];
      }
      return undefined;
    }

    if (typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }

    return undefined;
  }, payload);
};

export const pickString = (
  payload: Record<string, unknown>,
  paths: readonly string[],
): string | null => {
  for (const path of paths) {
    const value = getNestedValue(payload, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

export const pickNumber = (
  payload: Record<string, unknown>,
  paths: readonly string[],
): number | null => {
  for (const path of paths) {
    const value = getNestedValue(payload, path);

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

export const extractSalesCollection = (
  payload: unknown,
): Record<string, unknown>[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => typeof item === "object" && !!item);
  }

  if (typeof payload === "object" && payload) {
    for (const key of candidateKeys) {
      const candidate = (payload as Record<string, unknown>)[key];
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => typeof item === "object" && !!item);
      }
    }
  }

  return [];
};
