import { formatSaoPaulo } from './dates';
import { normalizeStatusToken, resolvePriorityStatusToken } from './normalization';
import { getBadgeVariant, STATUS_LABEL } from './status';
import type { BadgeVariant } from '../components/Badge';

export type HistoryStatusDisplay = {
  token: string | null;
  variant: BadgeVariant;
  label: string;
};

export const formatHistoryDate = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }

  try {
    return formatSaoPaulo(value);
  } catch (error) {
    return '—';
  }
};

const resolveHistoryStatusToken = (
  primaryStatus: string | null | undefined,
  fallbackStatus: string | null | undefined,
): string | null => {
  const updatePriority = resolvePriorityStatusToken(primaryStatus);
  const snapshotPriority = resolvePriorityStatusToken(fallbackStatus);

  if (snapshotPriority && snapshotPriority !== updatePriority) {
    return snapshotPriority;
  }

  if (updatePriority) {
    return updatePriority;
  }

  const normalizedPrimary = normalizeStatusToken(primaryStatus);
  if (normalizedPrimary) {
    return normalizedPrimary;
  }

  if (snapshotPriority) {
    return snapshotPriority;
  }

  const normalizedFallback = normalizeStatusToken(fallbackStatus);
  return normalizedFallback || null;
};

export const resolveHistoryStatus = (
  primaryStatus: string | null | undefined,
  fallbackStatus: string | null | undefined,
): HistoryStatusDisplay => {
  const token = resolveHistoryStatusToken(primaryStatus, fallbackStatus);
  const variant = getBadgeVariant(token ?? '');
  const label =
    variant === 'error' && !token ? '—' : STATUS_LABEL[variant] ?? token ?? '—';

  return {
    token,
    variant,
    label,
  };
};
