import type { BadgeVariant } from '../components/Badge';

export const STATUS_LABEL: Record<BadgeVariant, string> = {
  new: 'Novo',
  approved: 'Aprovado',
  pending: 'Abandonado',
  abandoned: 'Abandonado',
  sent: 'E-mail enviado',
  converted: 'Convertido',
  refunded: 'Reembolsado',
  refused: 'Recusado',
  error: 'Erro',
};

const VARIANT_SET = new Set<BadgeVariant>([
  'new',
  'approved',
  'pending',
  'abandoned',
  'sent',
  'converted',
  'refunded',
  'refused',
  'error',
]);

const STATUS_ALIASES: Record<string, BadgeVariant> = {
  abandonado: 'abandoned',
  abandoned: 'abandoned',
  pendente: 'pending',
  pending: 'pending',
  novo: 'new',
  new: 'new',
  aprovado: 'approved',
  approved: 'approved',
  convertido: 'converted',
  converted: 'converted',
  reembolsado: 'refunded',
  refunded: 'refunded',
  recusado: 'refused',
  refused: 'refused',
  enviado: 'sent',
  sent: 'sent',
};

export function getBadgeVariant(status: string): BadgeVariant {
  const normalized = status?.toLowerCase().trim() ?? '';
  if (!normalized) {
    return 'error';
  }

  const alias = STATUS_ALIASES[normalized];
  if (alias) {
    return alias;
  }

  return VARIANT_SET.has(normalized as BadgeVariant) ? (normalized as BadgeVariant) : 'error';
}
