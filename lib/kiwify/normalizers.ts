import { kfyCustomerSchema, kfyOrderSchema, kfyProductSchema, type KfyCustomer, type KfyOrder, type KfyProduct } from "@/types/kfy";

import { mapPaymentMethod, mapStatus } from "@/lib/kfyMapping";

const FALLBACK_CUSTOMER_EMAIL = "sem-email@kiwify.com";
const FALLBACK_CUSTOMER_NAME = "Cliente sem nome";

const parseAmountCents = (value: unknown): number => {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return value;
    }
    return Math.round(value * 100);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }

    const cleaned = trimmed.replace(/[^0-9.,-]/g, "");
    if (!cleaned) {
      return 0;
    }

    const hasDecimalSeparator = cleaned.includes(",") || cleaned.includes(".");
    const normalized = cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, ".");

    const numeric = Number.parseFloat(normalized);
    if (Number.isNaN(numeric)) {
      return 0;
    }

    if (hasDecimalSeparator && !Number.isInteger(numeric)) {
      return Math.round(numeric * 100);
    }

    return Math.round(numeric);
  }

  return 0;
};

const parseDateValue = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const asMilliseconds = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(asMilliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }

    const isoFallback = new Date(`${trimmed}T00:00:00Z`);
    return Number.isNaN(isoFallback.getTime()) ? null : isoFallback;
  }

  return null;
};

const coalesceString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

export function normalizeProduct(raw: unknown): KfyProduct {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const createdAt = parseDateValue(data.created_at ?? data.createdAt) ?? new Date();
  const updatedAt =
    parseDateValue(data.updated_at ?? data.updatedAt) ?? createdAt;

  const amountData =
    data.amount && typeof data.amount === "object"
      ? (data.amount as Record<string, unknown>)
      : undefined;

  return kfyProductSchema.parse({
    externalId: coalesceString(data.id, data.external_id, data.product_id) ?? "",
    title: coalesceString(data.title, data.name, data.product_name, "Produto sem título") ?? "",
    description: (coalesceString(data.description, data.summary, data.details) ?? null) as string | null,
    imageUrl: coalesceString(data.image_url, data.cover_url, data.thumbnail_url) ?? null,
    priceCents: parseAmountCents(
      data.price_cents ??
        data.price ??
        data.price_amount ??
        amountData?.price ??
        amountData?.value,
    ),
    currency: (coalesceString(data.currency, data.price_currency, "BRL") ?? "BRL") as string,
    status: mapStatus(coalesceString(data.status, data.state, "pending") ?? "pending"),
    createdAt,
    updatedAt,
    raw: data,
  });
}

export function normalizeCustomer(
  raw: unknown,
  fallback: { createdAt?: Date; updatedAt?: Date; externalId?: string } = {},
): KfyCustomer {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const createdAt = parseDateValue(data.created_at ?? data.createdAt) ?? fallback.createdAt ?? new Date();
  const updatedAt =
    parseDateValue(data.updated_at ?? data.updatedAt) ?? fallback.updatedAt ?? createdAt;

  const externalId =
    coalesceString(data.id, data.external_id, data.customer_id, data.user_id, fallback.externalId) ?? "";

  const name =
    coalesceString(
      data.name,
      data.full_name,
      `${coalesceString(data.first_name) ?? ""} ${coalesceString(data.last_name) ?? ""}`,
      FALLBACK_CUSTOMER_NAME,
    ) ?? FALLBACK_CUSTOMER_NAME;

  const email =
    coalesceString(
      data.email,
      data.contact_email,
      data.customer_email,
      data.user_email,
      FALLBACK_CUSTOMER_EMAIL,
    ) ?? FALLBACK_CUSTOMER_EMAIL;

  return kfyCustomerSchema.parse({
    externalId,
    name,
    email,
    phone: coalesceString(data.phone, data.phone_number, data.contact_phone),
    country: coalesceString(data.country, data.country_code, data.address_country),
    createdAt,
    updatedAt,
    raw: data,
  });
}

export interface NormalizedSaleRecord {
  order: KfyOrder;
  customer: KfyCustomer;
  product: KfyProduct | null;
  raw: unknown;
}

export function normalizeSale(raw: unknown): NormalizedSaleRecord | null {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!data) {
    return null;
  }

  const createdAt =
    parseDateValue(
      data.created_at ?? data.createdAt ?? data.paid_at ?? data.sale_created_at ?? data.date,
    ) ?? new Date();
  const updatedAt =
    parseDateValue(data.updated_at ?? data.updatedAt ?? data.last_update ?? data.paid_at) ?? createdAt;

  const amountData =
    data.amount && typeof data.amount === "object"
      ? (data.amount as Record<string, unknown>)
      : undefined;
  const paymentData =
    data.payment && typeof data.payment === "object"
      ? (data.payment as Record<string, unknown>)
      : undefined;
  const refundData =
    data.refund && typeof data.refund === "object"
      ? (data.refund as Record<string, unknown>)
      : undefined;
  const cancelData =
    data.cancel && typeof data.cancel === "object"
      ? (data.cancel as Record<string, unknown>)
      : undefined;

  const productPayload =
    (data.product as unknown) ??
    (data.course as unknown) ??
    (data.item as unknown) ??
    (data.offer as unknown) ??
    null;

  let product: KfyProduct | null = null;
  if (productPayload) {
    try {
      product = normalizeProduct(productPayload);
    } catch (error) {
      console.warn("[kiwify] Produto inválido em venda, ignorando detalhes do produto", error);
      product = null;
    }
  }

  const order = kfyOrderSchema.parse({
    externalId: coalesceString(data.id, data.external_id, data.sale_id) ?? "",
    productExternalId:
      coalesceString(
        data.product_id,
        data.product_external_id,
        product?.externalId,
        data.course_id,
        data.offer_id,
      ) ?? "",
    customerExternalId:
      coalesceString(
        data.customer_id,
        data.customer_external_id,
        data.client_id,
        data.user_id,
        (data.customer && typeof data.customer === "object"
          ? ((data.customer as Record<string, unknown>).id as string | undefined)
          : undefined),
      ) ?? "",
    status: mapStatus(coalesceString(data.status, data.payment_status, data.state, "pending") ?? "pending"),
    paymentMethod: mapPaymentMethod(
      coalesceString(data.payment_method, data.method, paymentData?.method),
    ),
    grossCents: parseAmountCents(
      data.amount_gross ??
        data.gross_amount ??
        amountData?.gross ??
        data.total_gross ??
        data.value_gross ??
        data.amount_total,
    ),
    feeCents: parseAmountCents(
      data.amount_fee ?? data.fee_amount ?? amountData?.fee ?? data.total_fee ?? data.value_fee,
    ),
    netCents: parseAmountCents(
      data.amount_net ??
        data.net_amount ??
        amountData?.net ??
        data.total_net ??
        data.value_net ??
        data.amount_received,
    ),
    commissionCents: parseAmountCents(
      data.amount_commission ??
        data.commission_amount ??
        amountData?.commission ??
        data.total_commission ??
        data.affiliate_commission,
    ),
    currency: (coalesceString(data.currency, amountData?.currency, "BRL") ?? "BRL") as string,
    approvedAt: parseDateValue(data.approved_at ?? data.paid_at ?? data.completed_at),
    refundedAt: parseDateValue(data.refunded_at ?? refundData?.created_at ?? data.chargeback_at),
    canceledAt: parseDateValue(
      data.canceled_at ?? data.cancelled_at ?? data.cancel_at ?? cancelData?.created_at,
    ),
    createdAt,
    updatedAt,
    raw: data,
  });

  if (!order.externalId || !order.productExternalId || !order.customerExternalId) {
    return null;
  }

  let customerPayload: unknown = data.customer ?? data.buyer ?? null;

  if (!customerPayload) {
    customerPayload = {
      id: data.customer_id ?? data.client_id ?? data.user_id,
      name: coalesceString(data.customer_name, data.client_name, data.user_name),
      email: coalesceString(data.customer_email, data.client_email, data.user_email),
      phone: coalesceString(data.customer_phone, data.client_phone),
      country: data.customer_country,
      created_at: data.customer_created_at,
      updated_at: data.customer_updated_at,
    };
  }

  let customer: KfyCustomer;
  try {
    customer = normalizeCustomer(customerPayload, {
      createdAt,
      updatedAt,
      externalId: order.customerExternalId,
    });
  } catch (error) {
    console.warn("[kiwify] Cliente inválido em venda, ignorando registro", error);
    return null;
  }

  return {
    order,
    customer,
    product,
    raw: data,
  };
}
