import type { BadgeVariant } from '../components/Badge';

export const STATUS_LABEL: Record<BadgeVariant, string> = {
  new: 'Novo',
  approved: 'Aprovado',
  pending: 'Pendente',
  abandoned: 'Abandonado',
  refunded: 'Reembolsado',
  refused: 'Recusado',
  error: 'Erro',
};

const VARIANT_SET = new Set<BadgeVariant>([
  'new',
  'approved',
  'pending',
  'abandoned',
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
  convertido: 'approved',
  converted: 'approved',
  reembolsado: 'refunded',
  refunded: 'refunded',
  recusado: 'refused',
  refused: 'refused',
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
