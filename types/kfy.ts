import { z } from "zod";

export const currencySchema = z.string().min(1);

export const kfyStatusEnum = z.enum([
  "approved",
  "pending",
  "refunded",
  "rejected",
  "canceled",
  "expired",
  "chargeback",
]);

export const kfyPaymentMethodEnum = z.enum([
  "pix",
  "card",
  "boleto",
  "unknown",
]);

export const paginationCursorSchema = z.object({
  nextCursor: z.string().nullable().optional(),
});

export const kfyProductSchema = z.object({
  externalId: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  priceCents: z.number().int(),
  currency: currencySchema,
  status: kfyStatusEnum,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  raw: z.record(z.any()).optional(),
});

export const kfyCustomerSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  raw: z.record(z.any()).optional(),
});

export const kfyOrderSchema = z.object({
  externalId: z.string(),
  productExternalId: z.string(),
  customerExternalId: z.string(),
  status: kfyStatusEnum,
  paymentMethod: kfyPaymentMethodEnum,
  grossCents: z.number().int(),
  feeCents: z.number().int(),
  netCents: z.number().int(),
  commissionCents: z.number().int(),
  currency: currencySchema,
  approvedAt: z.coerce.date().nullable(),
  refundedAt: z.coerce.date().nullable(),
  canceledAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  raw: z.record(z.any()).optional(),
});

export const kfyRefundSchema = z.object({
  externalId: z.string(),
  orderExternalId: z.string(),
  reason: z.string().nullable().optional(),
  amountCents: z.number().int(),
  status: kfyStatusEnum,
  createdAt: z.coerce.date(),
  processedAt: z.coerce.date().nullable(),
  raw: z.record(z.any()).optional(),
});

export const kfyEnrollmentSchema = z.object({
  externalId: z.string(),
  customerExternalId: z.string(),
  productExternalId: z.string(),
  status: kfyStatusEnum,
  startedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  raw: z.record(z.any()).optional(),
});

export const kfyCouponSchema = z.object({
  externalId: z.string(),
  code: z.string(),
  type: z.enum(["percent", "amount"]),
  value: z.number(),
  active: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  raw: z.record(z.any()).optional(),
});

export const kfyEventSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string(),
  externalId: z.string(),
  payload: z.record(z.any()),
  occurredAt: z.coerce.date(),
  receivedAt: z.coerce.date(),
});

export const kfyKpiOverviewSchema = z.object({
  grossCents: z.number().int(),
  netCents: z.number().int(),
  feeCents: z.number().int(),
  commissionCents: z.number().int(),
});

export const kfyStatusCountsSchema = z.object({
  approved: z.number().int(),
  pending: z.number().int(),
  refunded: z.number().int(),
  rejected: z.number().int(),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type KfyProduct = z.infer<typeof kfyProductSchema>;
export type KfyCustomer = z.infer<typeof kfyCustomerSchema>;
export type KfyOrder = z.infer<typeof kfyOrderSchema>;
export type KfyRefund = z.infer<typeof kfyRefundSchema>;
export type KfyEnrollment = z.infer<typeof kfyEnrollmentSchema>;
export type KfyCoupon = z.infer<typeof kfyCouponSchema>;
export type KfyEvent = z.infer<typeof kfyEventSchema>;
export type KfyKpiOverview = z.infer<typeof kfyKpiOverviewSchema>;
export type KfyStatusCounts = z.infer<typeof kfyStatusCountsSchema>;
