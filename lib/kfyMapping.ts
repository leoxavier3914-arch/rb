export const INTERNAL_STATUS = {
  APPROVED: "approved",
  PENDING: "pending",
  REFUNDED: "refunded",
  REJECTED: "rejected",
  CANCELED: "canceled",
  EXPIRED: "expired",
  CHARGEBACK: "chargeback",
} as const;

export type InternalStatus = (typeof INTERNAL_STATUS)[keyof typeof INTERNAL_STATUS];

const statusMap = new Map<string, InternalStatus>([
  ["approved", INTERNAL_STATUS.APPROVED],
  ["paid", INTERNAL_STATUS.APPROVED],
  ["pending", INTERNAL_STATUS.PENDING],
  ["waiting_payment", INTERNAL_STATUS.PENDING],
  ["refunded", INTERNAL_STATUS.REFUNDED],
  ["chargeback", INTERNAL_STATUS.CHARGEBACK],
  ["rejected", INTERNAL_STATUS.REJECTED],
  ["canceled", INTERNAL_STATUS.CANCELED],
  ["expired", INTERNAL_STATUS.EXPIRED],
]);

export const INTERNAL_PAYMENT_METHOD = {
  PIX: "pix",
  CARD: "card",
  BOLETO: "boleto",
  UNKNOWN: "unknown",
} as const;

export type InternalPaymentMethod =
  (typeof INTERNAL_PAYMENT_METHOD)[keyof typeof INTERNAL_PAYMENT_METHOD];

const paymentMethodMap = new Map<string, InternalPaymentMethod>([
  ["pix", INTERNAL_PAYMENT_METHOD.PIX],
  ["credit_card", INTERNAL_PAYMENT_METHOD.CARD],
  ["boleto", INTERNAL_PAYMENT_METHOD.BOLETO],
]);

export function mapStatus(status: string): InternalStatus {
  const normalized = status.toLowerCase();
  return statusMap.get(normalized) ?? INTERNAL_STATUS.PENDING;
}

export function mapPaymentMethod(method: string | null | undefined): InternalPaymentMethod {
  if (!method) return INTERNAL_PAYMENT_METHOD.UNKNOWN;
  const normalized = method.toLowerCase();
  return paymentMethodMap.get(normalized) ?? INTERNAL_PAYMENT_METHOD.UNKNOWN;
}
