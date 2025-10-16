const IGNORED_TEXT_VALUES = new Set([
  '',
  '-',
  '—',
  'unknown',
  'desconhecido',
  'desconhecida',
  'sem origem',
  'sem origem definida',
  'nao informado',
  'não informado',
  'não informado',
]);

export const cleanText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const text = value.trim();
  if (!text) {
    return '';
  }

  const normalized = text.normalize('NFC').toLowerCase();
  return IGNORED_TEXT_VALUES.has(normalized) ? '' : text;
};

export const normalizeStatusToken = (value: unknown): string => {
  const text = cleanText(value);
  return text ? text.toLowerCase() : '';
};

const TRUE_TOKENS = new Set(['true', 't', '1', 'yes', 'y', 'sim', 's']);
const FALSE_TOKENS = new Set(['false', 'f', '0', 'no', 'n', 'nao', 'não', 'não']);

export const coerceBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'bigint') {
    return value !== BigInt(0);
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    if (TRUE_TOKENS.has(normalized)) {
      return true;
    }
    if (FALSE_TOKENS.has(normalized)) {
      return false;
    }
  }

  return false;
};

export const APPROVED_STATUS_TOKENS = new Set([
  'converted',
  'convertido',
  'convertida',
  'paid',
  'pago',
  'paga',
  'pagamento aprovado',
  'payment.approved',
  'payment_approved',
  'pagamento.aprovado',
  'approved',
  'aprovado',
  'aprovada',
  'approved_pending_settlement',
  'completed',
  'complete',
  'concluido',
  'concluído',
]);

export const ABANDONED_STATUS_TOKENS = new Set([
  'abandoned',
  'abandonado',
  'abandonada',
  'abandoned_cart',
  'abandoned_checkout',
  'carrinho_abandonado',
  'carrinho-abandonado',
]);

export const REFUNDED_STATUS_TOKENS = new Set([
  'refunded',
  'refund',
  'refunded_pending',
  'reembolso',
  'reembolsado',
  'reembolsada',
  'estornado',
  'estornada',
  'chargeback',
  'charge_back',
  'devolvido',
  'devolvida',
  'payment.refunded',
  'payment_refunded',
]);

export const REFUSED_STATUS_TOKENS = new Set([
  'refused',
  'refuse',
  'recusado',
  'recusada',
  'rejected',
  'reject',
  'declined',
  'denied',
  'failed',
  'failure',
  'falha',
  'cancelled',
  'canceled',
  'cancelado',
  'cancelada',
  'payment.refused',
  'payment_refused',
  'payment.failed',
  'payment_failed',
]);

export const SENT_STATUS_TOKENS = new Set([
  'sent',
  'email_sent',
  'email.sent',
  'manual.email.sent',
  'manual_email_sent',
  'reminder_sent',
  'enviado',
  'enviada',
]);

export const PENDING_STATUS_TOKENS = new Set([
  'pending',
  'pendente',
  'pendente_pagamento',
  'awaiting',
  'awaiting_payment',
  'aguardando',
  'aguardando_pagamento',
  'open',
  'em_aberto',
]);

export const NEW_STATUS_TOKENS = new Set(['new', 'novo', 'nova']);

type PriorityStatusGroup = {
  tokens: Set<string>;
  canonical: string;
};

const PRIORITY_STATUS_GROUPS: PriorityStatusGroup[] = [
  { tokens: ABANDONED_STATUS_TOKENS, canonical: 'abandoned' },
  { tokens: REFUSED_STATUS_TOKENS, canonical: 'refused' },
  { tokens: REFUNDED_STATUS_TOKENS, canonical: 'refunded' },
];

export const resolvePriorityStatusToken = (value: unknown): string | null => {
  const normalized = normalizeStatusToken(value);
  if (!normalized) {
    return null;
  }

  for (const group of PRIORITY_STATUS_GROUPS) {
    if (group.tokens.has(normalized)) {
      return group.canonical;
    }
  }

  return null;
};
