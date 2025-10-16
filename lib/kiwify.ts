import { createHash } from "node:crypto";

interface NormalizedBase {
  eventReference: string;
  customerName: string | null;
  customerEmail: string | null;
  productName: string | null;
  amount: number | null;
  currency: string | null;
  occurredAt: string | null;
  payload: Record<string, unknown>;
}

export interface NormalizedSaleLike extends NormalizedBase {
  saleId: string | null;
  paymentMethod: string | null;
}

export type NormalizedApprovedSale = NormalizedSaleLike;
export type NormalizedPendingPayment = NormalizedSaleLike;
export type NormalizedRejectedPayment = NormalizedSaleLike;
export type NormalizedRefundedSale = NormalizedSaleLike;

export interface NormalizedAbandonedCart extends NormalizedBase {
  cartId: string | null;
  checkoutUrl: string | null;
  status: string | null;
}

type UnknownPayload = Record<string, unknown>;

const stringCoalesce = (payload: UnknownPayload, paths: string[]) => {
  for (const path of paths) {
    const value = get(payload, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const numberCoalesce = (payload: UnknownPayload, paths: string[]) => {
  for (const path of paths) {
    const raw = get(payload, path);
    if (raw === null || raw === undefined) continue;
    const parsed = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.,-]/g, "").replace(",", "."));
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

function get(payload: UnknownPayload, path: string) {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    if (Array.isArray(acc)) {
      const index = Number(key);
      if (!Number.isNaN(index)) {
        return acc[index];
      }
    }
    return undefined;
  }, payload);
}

const normalizeDate = (payload: UnknownPayload, paths: string[]) => {
  for (const path of paths) {
    const value = get(payload, path);
    if (!value) continue;
    const candidate = typeof value === "number" ? new Date(value * 1000) : new Date(String(value));
    if (!Number.isNaN(candidate.getTime())) {
      return candidate.toISOString();
    }
  }
  return null;
};

const fingerprint = (payload: UnknownPayload, hint?: string | null) => {
  const base = hint ?? JSON.stringify(payload ?? {});
  return createHash("sha1").update(base).digest("hex");
};

const normalizeSaleLike = (payload: UnknownPayload): NormalizedSaleLike => {
  const saleId = stringCoalesce(payload, [
    "id",
    "data.id",
    "data.sale_id",
    "sale.id",
    "transaction.id",
  ]);

  const customerName = stringCoalesce(payload, [
    "customer.name",
    "data.customer.name",
    "buyer.name",
    "data.buyer.name",
  ]);

  const customerEmail = stringCoalesce(payload, [
    "customer.email",
    "data.customer.email",
    "buyer.email",
    "data.buyer.email",
  ]);

  const productName = stringCoalesce(payload, [
    "product.name",
    "data.product.name",
    "items.0.product.name",
    "data.items.0.product.name",
  ]);

  const amount = numberCoalesce(payload, [
    "amount",
    "data.amount",
    "transaction.amount",
    "data.transaction.amount",
    "order.amount",
    "data.order.amount",
    "value",
    "price",
  ]);

  const currency = stringCoalesce(payload, [
    "currency",
    "data.currency",
    "transaction.currency",
    "data.transaction.currency",
  ]);

  const paymentMethod = stringCoalesce(payload, [
    "payment.method",
    "data.payment.method",
    "transaction.payment_method",
    "data.transaction.payment_method",
  ]);

  const occurredAt = normalizeDate(payload, [
    "paid_at",
    "created_at",
    "data.paid_at",
    "data.created_at",
    "transaction.paid_at",
    "data.transaction.paid_at",
    "data.payment.confirmed_at",
    "event_time",
  ]);

  const eventReference =
    saleId ?? customerEmail ?? fingerprint(payload, productName ?? occurredAt ?? null);

  return {
    eventReference,
    saleId,
    customerName,
    customerEmail,
    productName,
    amount,
    currency,
    paymentMethod,
    occurredAt,
    payload,
  };
};

export const normalizeApprovedSale = (
  payload: UnknownPayload,
): NormalizedApprovedSale => {
  return normalizeSaleLike(payload);
};

export const normalizePendingPayment = (
  payload: UnknownPayload,
): NormalizedPendingPayment => {
  return normalizeSaleLike(payload);
};

export const normalizeRejectedPayment = (
  payload: UnknownPayload,
): NormalizedRejectedPayment => {
  return normalizeSaleLike(payload);
};

export const normalizeRefundedSale = (
  payload: UnknownPayload,
): NormalizedRefundedSale => {
  return normalizeSaleLike(payload);
};

export const normalizeAbandonedCart = (
  payload: UnknownPayload,
): NormalizedAbandonedCart => {
  const cartId = stringCoalesce(payload, [
    "id",
    "data.id",
    "cart_id",
    "data.cart_id",
    "checkout.id",
  ]);

  const customerName = stringCoalesce(payload, [
    "customer.name",
    "data.customer.name",
    "buyer.name",
    "data.buyer.name",
  ]);

  const customerEmail = stringCoalesce(payload, [
    "customer.email",
    "data.customer.email",
    "buyer.email",
    "data.buyer.email",
  ]);

  const productName = stringCoalesce(payload, [
    "product.name",
    "data.product.name",
    "items.0.product.name",
    "data.items.0.product.name",
  ]);

  const amount = numberCoalesce(payload, [
    "amount",
    "data.amount",
    "order.amount",
    "data.order.amount",
    "value",
    "price",
  ]);

  const currency = stringCoalesce(payload, [
    "currency",
    "data.currency",
    "order.currency",
    "data.order.currency",
  ]);

  const checkoutUrl = stringCoalesce(payload, [
    "checkout_url",
    "data.checkout_url",
    "checkout.url",
    "data.checkout.url",
  ]);

  const status = stringCoalesce(payload, [
    "status",
    "data.status",
    "checkout.status",
    "data.checkout.status",
  ]);

  const occurredAt = normalizeDate(payload, [
    "abandoned_at",
    "created_at",
    "data.abandoned_at",
    "data.created_at",
    "event_time",
  ]);

  const eventReference =
    cartId ?? checkoutUrl ?? customerEmail ?? fingerprint(payload, productName ?? occurredAt ?? null);

  return {
    eventReference,
    cartId,
    customerName,
    customerEmail,
    productName,
    amount,
    currency,
    checkoutUrl,
    status,
    occurredAt,
    payload,
  };
};

export type EventKind =
  | "approved_sale"
  | "pending_payment"
  | "rejected_payment"
  | "refunded_sale"
  | "abandoned_cart";

const collectCandidates = (payload: UnknownPayload) => {
  const candidates = [
    stringCoalesce(payload, ["event", "type", "data.event", "data.type", "trigger"]),
    stringCoalesce(payload, [
      "status",
      "data.status",
      "payment.status",
      "data.payment.status",
      "sale.status",
      "data.sale.status",
      "transaction.status",
      "data.transaction.status",
      "order.order_status",
      "data.order.order_status",
    ]),
    stringCoalesce(payload, [
      "payment_status",
      "data.payment_status",
      "order.order_status",
      "data.order.order_status",
      "data.order.status",
      "order.status",
      "order.webhook_event_type",
    ]),
    stringCoalesce(payload, ["reason", "data.reason", "data.cause"]),
  ];

  return candidates
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.toLowerCase());
};

const includesAny = (candidates: string[], keywords: string[]) => {
  return candidates.some((candidate) => keywords.some((keyword) => candidate.includes(keyword)));
};

export const detectEventKind = (payload: UnknownPayload): EventKind | null => {
  const candidates = collectCandidates(payload);

  if (includesAny(candidates, ["abandon"])) {
    return "abandoned_cart";
  }

  if (includesAny(candidates, ["chargeback", "refund", "refunded", "reversal", "charge_back"])) {
    return "refunded_sale";
  }

  if (includesAny(candidates, ["refuse", "reject", "denied", "failed", "cancelled", "canceled", "void"])) {
    return "rejected_payment";
  }

  if (includesAny(candidates, ["pending", "awaiting", "waiting", "processing"])) {
    return "pending_payment";
  }

  if (includesAny(candidates, ["approved", "paid", "completed", "confirmed"])) {
    return "approved_sale";
  }

  return null;
};
