import { formatHistoryDate, resolveHistoryStatus } from './historyFormatting';
import { PURCHASE_TYPE_LABEL, resolvePurchaseType } from './purchaseType';
import type { AbandonedCartHistoryEntry, AbandonedCartUpdate } from './types';

export type StatusFilterValue = 'all' | string;
export type SortOrder = 'asc' | 'desc';

export type StatusOption = {
  value: string;
  label: string;
};

export type CheckoutHistorySummaryRow = {
  key: string;
  entry: AbandonedCartHistoryEntry;
  checkoutLabel: string;
  isCurrent: boolean;
  status: ReturnType<typeof resolveHistoryStatus>;
  statusToken: string | null;
  lastUpdatedLabel: string;
  timestampValue: number;
  interactions: number;
  interactionsLabel: string;
  purchaseTypeLabel: string | null;
};

export type CheckoutHistoryUpdateMeta = {
  update: AbandonedCartUpdate;
  status: ReturnType<typeof resolveHistoryStatus>;
  statusToken: string | null;
  timestampValue: number;
};

export const pickLatestTimestamp = (
  candidates: (string | null | undefined)[],
): { value: string | null; time: number } => {
  let latestValue: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const parsed = Date.parse(candidate);
    if (Number.isNaN(parsed)) {
      continue;
    }

    if (parsed >= latestTime) {
      latestTime = parsed;
      latestValue = candidate;
    }
  }

  return { value: latestValue, time: latestTime };
};

export const buildCheckoutHistorySummaries = (
  entries: AbandonedCartHistoryEntry[],
  currentCartKey: string | null,
): CheckoutHistorySummaryRow[] =>
  entries.map((entry) => {
    const latestUpdate = entry.updates[entry.updates.length - 1] ?? null;
    const snapshot = latestUpdate?.snapshot ?? entry.snapshot;
    const status = resolveHistoryStatus(
      latestUpdate?.status ?? latestUpdate?.snapshot.status ?? null,
      snapshot.status,
    );
    const { value: timestampSource, time: timestampValue } = pickLatestTimestamp([
      latestUpdate?.timestamp,
      latestUpdate?.snapshot.updated_at,
      latestUpdate?.snapshot.created_at,
      entry.snapshot.updated_at,
      entry.snapshot.created_at,
    ]);
    const interactions = entry.updates.length;
    const baseLabel = snapshot.checkout_id || snapshot.id || entry.cartKey;
    const checkoutLabel = baseLabel ? `Checkout ${baseLabel}` : 'Carrinho sem ID';
    const purchaseType = resolvePurchaseType(entry.updates, entry.snapshot);
    const purchaseTypeLabel = purchaseType ? PURCHASE_TYPE_LABEL[purchaseType] : null;

    return {
      key: entry.cartKey,
      entry,
      checkoutLabel,
      isCurrent: currentCartKey ? entry.cartKey === currentCartKey : false,
      status,
      statusToken: status.token,
      lastUpdatedLabel: formatHistoryDate(
        timestampSource ?? entry.snapshot.updated_at ?? entry.snapshot.created_at,
      ),
      timestampValue,
      interactions,
      interactionsLabel: interactions === 1 ? '1 interação' : `${interactions} interações`,
      purchaseTypeLabel,
    } satisfies CheckoutHistorySummaryRow;
  });

export const filterCheckoutHistorySummaries = (
  summaries: CheckoutHistorySummaryRow[],
  statusFilter: StatusFilterValue,
  sortOrder: SortOrder,
): CheckoutHistorySummaryRow[] => {
  const base =
    statusFilter === 'all'
      ? summaries.slice()
      : summaries.filter((summary) => summary.statusToken === statusFilter);

  base.sort((a, b) =>
    sortOrder === 'desc' ? b.timestampValue - a.timestampValue : a.timestampValue - b.timestampValue,
  );

  return base;
};

export const buildCheckoutHistoryUpdateMetas = (
  entry: AbandonedCartHistoryEntry | null,
): CheckoutHistoryUpdateMeta[] => {
  if (!entry) {
    return [];
  }

  return entry.updates.map((update) => {
    const status = resolveHistoryStatus(
      update.status ?? update.snapshot.status ?? null,
      update.snapshot.status,
    );
    const { time: timestampValue } = pickLatestTimestamp([
      update.timestamp,
      update.snapshot.updated_at,
      update.snapshot.created_at,
    ]);

    return {
      update,
      status,
      statusToken: status.token,
      timestampValue,
    } satisfies CheckoutHistoryUpdateMeta;
  });
};

export const filterCheckoutHistoryUpdateMetas = (
  metas: CheckoutHistoryUpdateMeta[],
  statusFilter: StatusFilterValue,
  sortOrder: SortOrder,
): CheckoutHistoryUpdateMeta[] => {
  const base =
    statusFilter === 'all' ? metas.slice() : metas.filter((meta) => meta.statusToken === statusFilter);

  base.sort((a, b) =>
    sortOrder === 'desc' ? b.timestampValue - a.timestampValue : a.timestampValue - b.timestampValue,
  );

  return base;
};

export const buildCheckoutHistoryStatusOptions = (
  summaries: CheckoutHistorySummaryRow[],
  metas: CheckoutHistoryUpdateMeta[],
): StatusOption[] => {
  const entries = new Map<string, string>();

  for (const summary of summaries) {
    if (summary.statusToken) {
      entries.set(summary.statusToken, summary.status.label);
    }
  }

  for (const meta of metas) {
    if (meta.statusToken) {
      entries.set(meta.statusToken, meta.status.label);
    }
  }

  return Array.from(entries.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
};
