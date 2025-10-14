import type { BadgeVariant } from '../components/Badge';

export const STATUS_LABEL: Record<BadgeVariant, string> = {
  pending: 'Pendente',
  sent: 'E-mail enviado',
  converted: 'Convertido',
  refunded: 'Reembolsado',
  error: 'Erro',
};

const badgeVariants = new Set<BadgeVariant>(['pending', 'sent', 'converted', 'refunded', 'error']);

export function getBadgeVariant(status: string): BadgeVariant {
  return badgeVariants.has(status as BadgeVariant) ? (status as BadgeVariant) : 'error';
}
