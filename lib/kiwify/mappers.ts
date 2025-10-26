type UnknownRecord = Record<string, unknown>;

export interface ProductRow {
  readonly id: string;
  readonly external_id: string;
  readonly title: string;
  readonly price_cents: number;
  readonly currency: string;
  readonly active: boolean;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly raw: unknown;
}

export interface CustomerRow {
  readonly id: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly country: string | null;
  readonly state: string | null;
  readonly city: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly raw: unknown;
}

export interface SaleRow {
  readonly id: string;
  readonly status: string | null;
  readonly product_id: string | null;
  readonly customer_id: string | null;
  readonly total_amount_cents: number;
  readonly fee_amount_cents: number;
  readonly net_amount_cents: number;
  readonly currency: string | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
  readonly updated_at: string | null;
  readonly raw: unknown;
}

export interface SubscriptionRow {
  readonly id: string;
  readonly customer_id: string | null;
  readonly product_id: string | null;
  readonly status: string | null;
  readonly started_at: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at: string | null;
  readonly canceled_at: string | null;
  readonly updated_at: string | null;
  readonly raw: unknown;
}

export interface EnrollmentRow {
  readonly id: string;
  readonly customer_id: string | null;
  readonly course_id: string | null;
  readonly status: string | null;
  readonly progress: number | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly raw: unknown;
}

export interface CouponRow {
  readonly id: string;
  readonly code: string | null;
  readonly percent_off: number | null;
  readonly amount_off_cents: number | null;
  readonly currency: string | null;
  readonly active: boolean;
  readonly created_at: string | null;
  readonly updated_at: string | null;
  readonly raw: unknown;
}

export interface RefundRow {
  readonly id: string;
  readonly sale_id: string | null;
  readonly amount_cents: number;
  readonly reason: string | null;
  readonly created_at: string | null;
  readonly raw: unknown;
}

export interface PayoutRow {
  readonly id: string;
  readonly amount_cents: number;
  readonly currency: string | null;
  readonly status: string | null;
  readonly scheduled_for: string | null;
  readonly paid_at: string | null;
  readonly created_at: string | null;
  readonly raw: unknown;
}

export function mapProductPayload(payload: UnknownRecord): ProductRow {
  const externalId = String(payload.id ?? payload.uuid ?? '');
  return {
    id: externalId,
    external_id: externalId,
    title: toNullableString(payload.title) ?? '',
    price_cents: toCents(payload.price_cents ?? payload.price ?? payload.price_br ?? 0),
    currency: toNullableString(payload.currency) ?? 'BRL',
    active: Boolean(payload.active ?? payload.enabled ?? true),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? null),
    updated_at: toIso(payload.updated_at ?? payload.updatedAt ?? null),
    raw: payload
  };
}

export function mapCustomerPayload(payload: UnknownRecord): CustomerRow {
  return {
    id: String(payload.id ?? payload.uuid ?? ''),
    name: toNullableString(payload.name ?? payload.full_name ?? payload.fullName),
    email: toNullableString(payload.email),
    phone: toNullableString(payload.phone ?? payload.phone_number ?? payload.whatsapp),
    country: toNullableString(payload.country ?? payload.country_code),
    state: toNullableString(payload.state ?? payload.state_code),
    city: toNullableString(payload.city),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? null),
    updated_at: toIso(payload.updated_at ?? payload.updatedAt ?? null),
    raw: payload
  };
}

export function mapSalePayload(payload: UnknownRecord): SaleRow {
  return {
    id: String(payload.id ?? payload.uuid ?? ''),
    status: toNullableString(payload.status),
    product_id: toNullableString(payload.product_id ?? payload.productId),
    customer_id: toNullableString(payload.customer_id ?? payload.customerId),
    total_amount_cents: toCents(
      payload.total_amount_cents ?? payload.total_amount ?? payload.amount ?? payload.total
    ),
    fee_amount_cents: toCents(payload.fee_amount_cents ?? payload.fee_amount ?? payload.fees ?? 0),
    net_amount_cents: toCents(payload.net_amount_cents ?? payload.net_amount ?? payload.net ?? 0),
    currency: toNullableString(payload.currency ?? payload.currency_code),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? payload.inserted_at ?? null),
    paid_at: toIso(payload.paid_at ?? payload.paidAt ?? payload.approved_at ?? null),
    updated_at: toIso(payload.updated_at ?? payload.updatedAt ?? null),
    raw: payload
  };
}

export function mapSubscriptionPayload(payload: UnknownRecord): SubscriptionRow {
  return {
    id: String(payload.id ?? payload.uuid ?? ''),
    customer_id: toNullableString(payload.customer_id ?? payload.customerId),
    product_id: toNullableString(payload.product_id ?? payload.productId),
    status: toNullableString(payload.status),
    started_at: toIso(payload.started_at ?? payload.start_at ?? payload.created_at ?? null),
    current_period_end: toIso(payload.current_period_end ?? payload.period_end ?? null),
    cancel_at: toIso(payload.cancel_at ?? payload.cancelAt ?? null),
    canceled_at: toIso(payload.canceled_at ?? payload.cancelled_at ?? payload.canceledAt ?? null),
    updated_at: toIso(payload.updated_at ?? payload.updatedAt ?? null),
    raw: payload
  };
}

export function mapEnrollmentPayload(payload: UnknownRecord): EnrollmentRow {
  return {
    id: String(payload.id ?? payload.uuid ?? ''),
    customer_id: toNullableString(payload.customer_id ?? payload.customerId),
    course_id: toNullableString(payload.course_id ?? payload.courseId ?? payload.product_id ?? null),
    status: toNullableString(payload.status),
    progress: toNullableNumber(payload.progress ?? payload.progress_percentage),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? null),
    updated_at: toIso(payload.updated_at ?? payload.updatedAt ?? null),
    raw: payload
  };
}

export function mapCouponPayload(payload: UnknownRecord): CouponRow {
  return {
    id: String(payload.id ?? payload.uuid ?? ''),
    code: toNullableString(payload.code ?? payload.coupon_code),
    percent_off: toNullableNumber(payload.percent_off ?? payload.discount_percent),
    amount_off_cents: toNullableCents(payload.amount_off_cents ?? payload.amount_off),
    currency: toNullableString(payload.currency ?? payload.currency_code),
    active: Boolean(payload.active ?? payload.enabled ?? true),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? null),
    updated_at: toIso(payload.updated_at ?? payload.updatedAt ?? null),
    raw: payload
  };
}

export function mapRefundPayload(payload: UnknownRecord): RefundRow {
  return {
    id: String(payload.id ?? payload.uuid ?? ''),
    sale_id: toNullableString(payload.sale_id ?? payload.saleId ?? payload.order_id),
    amount_cents: toCents(payload.amount_cents ?? payload.amount ?? payload.value ?? 0),
    reason: toNullableString(payload.reason ?? payload.reason_text),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? null),
    raw: payload
  };
}

export function mapPayoutPayload(payload: UnknownRecord): PayoutRow {
  return {
    id: String(payload.id ?? payload.uuid ?? ''),
    amount_cents: toCents(payload.amount_cents ?? payload.amount ?? payload.value ?? 0),
    currency: toNullableString(payload.currency ?? payload.currency_code),
    status: toNullableString(payload.status),
    scheduled_for: toIso(payload.scheduled_for ?? payload.scheduledFor ?? payload.scheduled_at ?? null),
    paid_at: toIso(payload.paid_at ?? payload.paidAt ?? null),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? null),
    raw: payload
  };
}

function toIso(value: unknown): string | null {
  if (!value) {
    return null;
  }
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch {
    return null;
  }
}

function toCents(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) {
      return value;
    }
    return Math.round(value * 100);
  }

  const numeric = Number.parseFloat(String(value).replace(',', '.'));
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.round(numeric * 100);
}

function toNullableCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return toCents(value);
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const numeric = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isNaN(numeric) ? null : numeric;
}
