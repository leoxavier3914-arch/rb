import { normalizeStatusToken } from './normalization';
import type { AbandonedCartSnapshot, AbandonedCartUpdate } from './types';

export type PurchaseType = 'direct' | 'return';

export const PURCHASE_TYPE_LABEL: Record<PurchaseType, string> = {
  direct: 'Compra direta',
  return: 'Compra retorno',
};

const getUpdateStatuses = (updates: AbandonedCartUpdate[]): string[] =>
  updates
    .map((update) => normalizeStatusToken(update.status ?? update.snapshot.status))
    .filter((status): status is string => Boolean(status));

export const resolvePurchaseType = (
  updates: AbandonedCartUpdate[],
  snapshot: AbandonedCartSnapshot,
): PurchaseType | null => {
  if (!snapshot) {
    return null;
  }

  const statuses = getUpdateStatuses(updates);
  let sawAbandonedBeforeApproval = false;

  for (const status of statuses) {
    if (status === 'abandoned') {
      sawAbandonedBeforeApproval = true;
      continue;
    }

    if (status === 'approved') {
      return sawAbandonedBeforeApproval ? 'return' : 'direct';
    }
  }

  const finalStatus = normalizeStatusToken(snapshot.status);
  const isPaid = Boolean(snapshot.paid || snapshot.paid_at);

  if (finalStatus === 'approved' || isPaid) {
    return sawAbandonedBeforeApproval ? 'return' : 'direct';
  }

  return null;
};
