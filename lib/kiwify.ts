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

export interface NormalizedSubscriptionEvent extends NormalizedSaleLike {
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  eventType: string | null;
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
    if (typeof raw !== "number" && typeof raw !== "string") {
      continue;
    }

    const parsed =
      typeof raw === "number"
        ? raw
        : Number(String(raw).replace(/[^0-9.,-]/g, "").replace(",", "."));
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

const normalizeAmount = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }

  if (Number.isInteger(value)) {
    return value / 100;
  }

  return value;
};

const normalizeSaleLike = (payload: UnknownPayload): NormalizedSaleLike => {
  const topLevelId = stringCoalesce(payload, ["id", "event_id", "payload_id", "data.event_id"]);

  const saleId = stringCoalesce(payload, [
    "order_id",
    "order.id",
    "Order.id",
    "order.order_id",
    "Order.order_id",
    "data.order_id",
    "data.order.order_id",
    "data.order.orderId",
    "data.id",
    "data.sale_id",
    "data.order.id",
    "data.orderId",
    "id",
    "sale.id",
    "transaction.id",
    "charges.completed.0.order_id",
    "Subscription.charges.completed.0.order_id",
  ]);

  const orderRef = stringCoalesce(payload, [
    "order_ref",
    "order.ref",
    "order.reference",
    "Order.reference",
    "Order.order_ref",
    "data.reference",
    "data.order.reference",
    "data.order.ref",
  ]);

  const customerName = stringCoalesce(payload, [
    "Customer.full_name",
    "Customer.name",
    "customer.name",
    "Customer.first_name",
    "customer.first_name",
    "data.customer.name",
    "data.customer.full_name",
    "data.order.customer.name",
    "data.order.customer.full_name",
    "buyer.name",
    "data.buyer.name",
  ]);

  const customerEmail = stringCoalesce(payload, [
    "Customer.email",
    "customer.email",
    "data.customer.email",
    "data.order.customer.email",
    "buyer.email",
    "data.buyer.email",
  ]);

  const productName = stringCoalesce(payload, [
    "Product.product_name",
    "Product.name",
    "product.name",
    "data.product.name",
    "data.order.product.name",
    "items.0.product.name",
    "data.items.0.product.name",
    "data.order.items.0.product.name",
  ]);

  const amount = normalizeAmount(
    numberCoalesce(payload, [
      "Commissions.charge_amount",
      "commissions.charge_amount",
      "charge_amount",
      "amount",
      "data.amount",
      "data.amount.value",
      "data.amount.value_cents",
      "data.amount.total",
      "data.amount.total_value",
      "data.order.amount",
      "data.order.amount.value",
      "data.order.amount.value_cents",
      "data.order.amount.total",
      "data.order.amount.total_value",
      "data.order.total",
      "data.order.total_value",
      "transaction.amount",
      "data.transaction.amount",
      "order.amount",
      "Order.amount",
      "data.order.amount",
      "value",
      "price",
      "charges.completed.0.amount",
      "Subscription.charges.completed.0.amount",
      "SmartInstallment.amount_total",
    ]),
  );

  const currency = stringCoalesce(payload, [
    "Commissions.currency",
    "commissions.currency",
    "currency",
    "data.currency",
    "data.amount.currency",
    "data.order.amount.currency",
    "data.order.currency",
    "transaction.currency",
    "data.transaction.currency",
    "order.currency",
    "Order.currency",
    "data.order.currency",
  ]);

  const paymentMethod = stringCoalesce(payload, [
    "payment_method",
    "payment.method",
    "data.payment.method",
    "data.order.payment.method",
    "transaction.payment_method",
    "data.transaction.payment_method",
    "charges.completed.0.payment_method",
    "Subscription.charges.completed.0.payment_method",
  ]);

  const occurredAt = normalizeDate(payload, [
    "approved_date",
    "paid_at",
    "created_at",
    "updated_at",
    "data.paid_at",
    "data.created_at",
    "data.updated_at",
    "data.amount.paid_at",
    "data.payment.paid_at",
    "data.payment.paidAt",
    "data.payment.confirmed_at",
    "data.order.paid_at",
    "data.order.payment.paid_at",
    "data.order.payment.paidAt",
    "data.order.updated_at",
    "data.order.created_at",
    "transaction.paid_at",
    "data.transaction.paid_at",
    "event_time",
    "charges.completed.0.created_at",
    "Subscription.charges.completed.0.created_at",
  ]);

  const eventReference =
    saleId ??
    orderRef ??
    topLevelId ??
    fingerprint(payload);

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
    "cart_id",
    "Cart.id",
    "cart.id",
    "checkout.id",
    "checkout_id",
    "data.id",
    "data.cart_id",
    "data.checkout.id",
    "data.checkout_id",
    "id",
  ]);

  const customerName = stringCoalesce(payload, [
    "Customer.full_name",
    "customer.name",
    "Customer.name",
    "data.customer.name",
    "data.customer.full_name",
    "buyer.name",
    "data.buyer.name",
    "data.checkout.customer.name",
  ]);

  const customerEmail = stringCoalesce(payload, [
    "Customer.email",
    "customer.email",
    "data.customer.email",
    "buyer.email",
    "data.buyer.email",
    "data.checkout.customer.email",
  ]);

  const productName = stringCoalesce(payload, [
    "Product.product_name",
    "Product.name",
    "product.name",
    "data.product.name",
    "items.0.product.name",
    "data.items.0.product.name",
    "data.checkout.items.0.product.name",
  ]);

  const amount = normalizeAmount(
    numberCoalesce(payload, [
      "amount",
      "data.amount",
      "data.amount.value",
      "data.amount.value_cents",
      "data.amount.total",
      "data.amount.total_value",
      "order.amount",
      "Order.amount",
      "data.order.amount",
      "data.checkout.amount",
      "data.checkout.amount.value",
      "data.checkout.amount.value_cents",
      "data.checkout.amount.total",
      "data.checkout.amount.total_value",
      "value",
      "price",
      "Commissions.charge_amount",
    ]),
  );

  const currency = stringCoalesce(payload, [
    "currency",
    "data.currency",
    "data.amount.currency",
    "order.currency",
    "Order.currency",
    "data.order.currency",
    "Commissions.currency",
    "data.checkout.currency",
    "data.checkout.amount.currency",
  ]);

  const checkoutUrl = stringCoalesce(payload, [
    "checkout_link",
    "Checkout.link",
    "Checkout.url",
    "checkout_url",
    "data.checkout_url",
    "checkout.url",
    "data.checkout.url",
    "data.url",
    "data.checkout_url",
    "data.checkout.checkout_url",
  ]);

  const status = stringCoalesce(payload, [
    "status",
    "data.status",
    "checkout.status",
    "data.checkout.status",
    "order_status",
    "order.status",
    "data.checkout.status",
  ]);

  const occurredAt = normalizeDate(payload, [
    "abandoned_at",
    "created_at",
    "data.abandoned_at",
    "data.created_at",
    "updated_at",
    "event_time",
    "data.updated_at",
    "data.timestamps.abandoned_at",
    "data.checkout.abandoned_at",
  ]);

  const eventLevelId = stringCoalesce(payload, [
    "event_id",
    "payload_id",
    "data.event_id",
    "id",
  ]);

  const eventReference =
    cartId ??
    checkoutUrl ??
    eventLevelId ??
    fingerprint(payload);

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

export const normalizeSubscriptionEvent = (
  payload: UnknownPayload,
): NormalizedSubscriptionEvent => {
  const base = normalizeSaleLike(payload);
  const subscriptionId = stringCoalesce(payload, [
    "subscription_id",
    "Subscription.id",
    "subscription.id",
    "Subscription.subscription_id",
    "data.id",
    "data.subscription_id",
    "data.subscription.id",
  ]);

  const subscriptionStatus = stringCoalesce(payload, [
    "Subscription.status",
    "subscription.status",
    "subscription_status",
    "data.subscription.status",
    "data.status",
  ]);

  const eventType = stringCoalesce(payload, [
    "webhook_event_type",
    "event_type",
    "event",
    "type",
    "data.event_type",
    "data.event",
  ]);

  const occurredAt =
    base.occurredAt ??
    normalizeDate(payload, [
      "subscription.updated_at",
      "Subscription.updated_at",
      "Subscription.start_date",
      "Subscription.next_payment",
      "data.subscription.updated_at",
      "data.subscription.next_payment",
      "data.updated_at",
    ]);

  const eventReference =
    subscriptionId ??
    base.saleId ??
    base.eventReference ??
    stringCoalesce(payload, ["id", "event_id", "payload_id"]) ??
    fingerprint(payload, eventType ?? subscriptionStatus ?? base.customerEmail ?? null);

  return {
    ...base,
    eventReference,
    occurredAt,
    subscriptionId,
    subscriptionStatus,
    eventType,
  };
};

export type EventKind =
  | "approved_sale"
  | "pending_payment"
  | "rejected_payment"
  | "refunded_sale"
  | "abandoned_cart"
  | "subscription_event";

const gatherCandidates = (payload: UnknownPayload, paths: string[]) => {
  const values: string[] = [];

  for (const path of paths) {
    const value = stringCoalesce(payload, [path]);
    if (value) {
      const normalized = value.toLowerCase();
      const sanitized = normalized.replace(/[^a-z0-9]+/g, "_");
      values.push(normalized);
      if (!values.includes(sanitized)) {
        values.push(sanitized);
      }
    }
  }

  return values;
};

const equalsAny = (candidates: string[], keywords: string[]) =>
  candidates.some((candidate) => keywords.includes(candidate));

const includesAny = (candidates: string[], keywords: string[]) =>
  candidates.some((candidate) => keywords.some((keyword) => candidate.includes(keyword)));

const EVENT_TYPE_PATHS = [
  "webhook_event_type",
  "webhook.event_type",
  "webhookEventType",
  "event_type",
  "eventType",
  "event",
  "type",
  "trigger",
  "data.webhook_event_type",
  "data.event_type",
  "data.event",
  "data.type",
  "order.webhook_event_type",
  "Order.webhook_event_type",
];

const STATUS_PATHS = [
  "order_status",
  "order.status",
  "Order.status",
  "order.order_status",
  "Order.order_status",
  "status",
  "Status",
  "payment_status",
  "payment.status",
  "Payment.status",
  "sale.status",
  "transaction.status",
  "Subscription.status",
  "subscription.status",
  "subscription_status",
  "charges.completed.0.status",
  "reason",
  "card_rejection_reason",
  "data.status",
  "data.order.status",
  "data.order.order_status",
  "data.payment.status",
  "order.webhook_event_type",
  "order.webhookEventType",
];

export const detectEventKind = (payload: UnknownPayload): EventKind | null => {
  const eventTypes = gatherCandidates(payload, EVENT_TYPE_PATHS);
  const statuses = gatherCandidates(payload, STATUS_PATHS);
  const combined = [...eventTypes, ...statuses];

  if (equalsAny(eventTypes, ["order_approved", "approved_sale"])) {
    return "approved_sale";
  }

  if (equalsAny(eventTypes, ["order_rejected", "purchase_rejected"])) {
    return "rejected_payment";
  }

  if (equalsAny(eventTypes, ["order_refunded", "refund", "chargeback"])) {
    return "refunded_sale";
  }

  if (equalsAny(eventTypes, ["pix_created", "billet_created", "pending_payment"])) {
    return "pending_payment";
  }

  if (eventTypes.some((candidate) => candidate.startsWith("subscription_"))) {
    return "subscription_event";
  }

  if (includesAny(eventTypes, ["abandon", "cart_abandoned"])) {
    return "abandoned_cart";
  }

  if (includesAny(combined, ["subscription"])) {
    return "subscription_event";
  }

  if (includesAny(combined, ["abandon"])) {
    return "abandoned_cart";
  }

  if (includesAny(combined, ["chargeback", "refund", "refunded", "reversal", "charge_back"])) {
    return "refunded_sale";
  }

  if (includesAny(combined, ["refuse", "reject", "denied", "failed", "cancelled", "canceled", "void"])) {
    return "rejected_payment";
  }

  if (includesAny(combined, [
    "pix_created",
    "billet_created",
    "pending",
    "awaiting",
    "waiting",
    "processing",
    "pix",
    "billet",
    "boleto",
    "issued",
  ])) {
    return "pending_payment";
  }

  if (includesAny(combined, ["approved", "paid", "completed", "confirmed"])) {
    return "approved_sale";
  }

  return null;
};
