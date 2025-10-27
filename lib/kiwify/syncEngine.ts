import { loadEnv } from '@/lib/env';
import { KiwifyHttpError, kiwifyFetch } from './http';
import {
  mapCouponPayload,
  mapEnrollmentPayload,
  mapCustomerFromSalePayload,
  mapPayoutPayload,
  mapProductPayload,
  mapRefundPayload,
  mapSalePayload,
  mapSubscriptionPayload,
  type CouponRow,
  type CustomerRow,
  type EnrollmentRow,
  type PayoutRow,
  type ProductRow,
  type RefundRow,
  type SaleRow,
  type SubscriptionRow
} from './mappers';
import { normalizeExternalId } from './ids';
import {
  SupabaseWriteError,
  upsertCoupons,
  upsertEnrollments,
  upsertPayouts,
  upsertProducts,
  upsertRefunds,
  upsertSales,
  upsertSubscriptions,
  upsertDerivedCustomers,
  resolveCustomerIds
} from './writes';
import {
  getSalesSyncState,
  getUnsupportedResources,
  setSalesSyncState,
  setSyncCursor,
  setUnsupportedResources
} from './syncState';

const DAY = 24 * 60 * 60 * 1000;

// Keep the sync budget safely within the /api/kfy/sync route's 300s maxDuration.
const MAX_SYNC_BUDGET_MS = 295_000;

const RESOURCES = [
  'products',
  'sales',
  'subscriptions',
  'enrollments',
  'coupons',
  'refunds',
  'payouts'
] as const;

export type SyncResource = (typeof RESOURCES)[number];

function isSupportedResource(value: unknown): value is SyncResource {
  if (typeof value !== 'string') {
    return false;
  }
  return (RESOURCES as readonly string[]).includes(value);
}

interface IntervalRange {
  readonly start: Date;
  readonly end: Date;
}

interface ParsedPage {
  readonly items: UnknownRecord[];
  readonly hasMore: boolean;
  readonly nextPage: number | null;
}

type UnknownRecord = Record<string, unknown>;

type Mapper<T> = (payload: UnknownRecord) => T;
type Writer<T> = (rows: readonly T[]) => Promise<number>;

interface ResourceConfig<T> {
  readonly path: string;
  readonly mapper: Mapper<T>;
  readonly writer: Writer<T>;
  readonly supportsRange: boolean;
}

const RESOURCE_CONFIG: Record<SyncResource, ResourceConfig<any>> = {
  products: {
    path: '/v1/products',
    mapper: mapProductPayload,
    writer: upsertProducts,
    supportsRange: false
  },
  sales: {
    path: '/v1/sales',
    mapper: mapSalePayload,
    writer: upsertSales,
    supportsRange: true
  },
  subscriptions: {
    path: '/v1/subscriptions',
    mapper: mapSubscriptionPayload,
    writer: upsertSubscriptions,
    supportsRange: true
  },
  enrollments: {
    path: '/v1/enrollments',
    mapper: mapEnrollmentPayload,
    writer: upsertEnrollments,
    supportsRange: true
  },
  coupons: {
    path: '/v1/coupons',
    mapper: mapCouponPayload,
    writer: upsertCoupons,
    supportsRange: true
  },
  refunds: {
    path: '/v1/refunds',
    mapper: mapRefundPayload,
    writer: upsertRefunds,
    supportsRange: true
  },
  payouts: {
    path: '/v1/payouts',
    mapper: mapPayoutPayload,
    writer: upsertPayouts,
    supportsRange: true
  }
};

export interface SyncCursor {
  readonly resource: SyncResource;
  readonly page: number;
  readonly intervalIndex: number;
  readonly done: boolean;
}

export interface SalesSyncState {
  readonly lastPaidAt: string | null;
  readonly lastCreatedAt: string | null;
}

export interface SyncRequest {
  readonly full?: boolean;
  readonly range?: {
    readonly startDate: string;
    readonly endDate: string;
  } | null;
  readonly cursor?: SyncCursor | null;
  readonly persist?: boolean;
}

export interface SyncResult {
  readonly ok: boolean;
  readonly done: boolean;
  readonly nextCursor: SyncCursor | null;
  readonly stats: Record<string, number>;
  readonly logs: readonly string[];
}

function parsePage(payload: UnknownRecord, fallbackPage: number): ParsedPage {
  const items = extractItems(payload);
  const pagination = extractPagination(payload);
  const page = pagination.page ?? fallbackPage;
  const totalPages = pagination.totalPages;
  const hasMore = determineHasMore(payload, page, totalPages, pagination.nextPage);
  const nextPage = hasMore ? (pagination.nextPage ?? page + 1) : null;
  return { items, hasMore, nextPage };
}

function extractItems(payload: UnknownRecord): UnknownRecord[] {
  if (Array.isArray(payload.data)) {
    return payload.data as UnknownRecord[];
  }
  if (Array.isArray(payload.items)) {
    return payload.items as UnknownRecord[];
  }
  if (Array.isArray(payload.results)) {
    return payload.results as UnknownRecord[];
  }
  return [];
}

function extractPagination(payload: UnknownRecord): {
  readonly page: number | null;
  readonly totalPages: number | null;
  readonly nextPage: number | null;
} {
  const meta = (payload.meta as UnknownRecord | undefined)?.pagination as UnknownRecord | undefined;
  const page = chooseNumber([payload.page_number, payload.pageNumber, meta?.page, meta?.current_page]);
  let totalPages = chooseNumber([payload.total_pages, payload.totalPages, meta?.total_pages]);
  const perPage = chooseNumber([
    payload.per_page,
    payload.perPage,
    payload.page_size,
    payload.pageSize,
    meta?.per_page,
    meta?.perPage,
    meta?.page_size,
    meta?.pageSize
  ]);
  if (totalPages === undefined) {
    const totalItems = chooseNumber([
      payload.total,
      payload.total_items,
      payload.totalItems,
      payload.count,
      meta?.total,
      meta?.total_items,
      meta?.totalItems,
      meta?.count
    ]);
    if (totalItems !== undefined && perPage !== undefined && perPage > 0) {
      totalPages = Math.ceil(totalItems / perPage);
    }
  }
  const nextPage = chooseNumber([payload.next_page, payload.nextPage, meta?.next_page]);
  return {
    page: page ?? null,
    totalPages: totalPages ?? null,
    nextPage: nextPage ?? null
  };
}

function determineHasMore(
  payload: UnknownRecord,
  page: number | null,
  totalPages: number | null,
  paginationNextPage: number | null
): boolean {
  if (typeof payload.has_more === 'boolean') {
    return payload.has_more;
  }
  const meta = (payload.meta as UnknownRecord | undefined)?.pagination as UnknownRecord | undefined;
  if (meta) {
    if (typeof meta.has_more === 'boolean') {
      return meta.has_more;
    }
    const metaHasMore = (meta.hasMore ?? null) as unknown;
    if (typeof metaHasMore === 'boolean') {
      return metaHasMore;
    }
  }
  if (page !== null && totalPages !== null) {
    return page < totalPages;
  }
  if (hasPaginationPointer(payload.next_page) || hasPaginationPointer(payload.nextPage)) {
    return true;
  }
  if (meta && (hasPaginationPointer(meta.next_page) || hasPaginationPointer(meta.nextPage))) {
    return true;
  }
  if (hasPaginationPointer(paginationNextPage)) {
    return true;
  }
  return false;
}

function hasPaginationPointer(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  return true;
}

function chooseNumber(candidates: Array<unknown>): number | undefined {
  for (const candidate of candidates) {
    const value = normalizeToFiniteNumber(candidate);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function normalizeToFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === 'bigint') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === 'object') {
    const candidate = (value as { valueOf?: () => unknown }).valueOf?.();
    if (candidate !== value) {
      return normalizeToFiniteNumber(candidate);
    }
  }
  return undefined;
}

function isUnsupportedResourceError(error: unknown): error is KiwifyHttpError {
  if (!(error instanceof KiwifyHttpError)) {
    return false;
  }
  if (error.status === 404) {
    return true;
  }
  if (error.isHtml && /cannot\s+get/i.test(error.bodyText)) {
    return true;
  }
  return false;
}

export function buildDefaultIntervals(): IntervalRange[] {
  const now = new Date();
  const end = new Date(now);
  const todayStart = startOfUtcDay(end);
  const ninetyDaysAgo = startOfUtcDay(addDays(todayStart, -90));
  return [
    { start: ninetyDaysAgo, end },
    { start: todayStart, end }
  ];
}

export interface SalesWindow {
  readonly start: string;
  readonly end: string;
}

export function buildSalesWindows(dateFrom: string | Date, dateTo: string | Date): SalesWindow[] {
  const fromDate = normalizeDateInput(dateFrom);
  const toDate = normalizeDateInput(dateTo);
  if (!fromDate || !toDate) {
    return [];
  }
  if (fromDate.getTime() > toDate.getTime()) {
    return [];
  }

  const windows: SalesWindow[] = [];
  let windowStart = fromDate;

  while (windowStart.getTime() <= toDate.getTime()) {
    const candidateEnd = addDays(windowStart, 89);
    const windowEnd = candidateEnd.getTime() > toDate.getTime() ? new Date(toDate) : candidateEnd;
    windows.push({ start: formatDateOnly(windowStart), end: formatDateOnly(windowEnd) });
    windowStart = addDays(windowEnd, 1);
  }

  return windows;
}

export interface SalesRangePreviewParams {
  readonly request?: Partial<SyncRequest>;
  readonly salesState?: SalesSyncState | null;
  readonly today?: Date;
  readonly accountCreationDate?: Date | null;
}

export async function previewSalesRangeForDoctor(
  params: SalesRangePreviewParams = {}
): Promise<IntervalRange | null> {
  const resolvedRequest: SyncRequest = {
    full: params.request?.full,
    range: params.request?.range ?? null,
    cursor: params.request?.cursor ?? null,
    persist: params.request?.persist
  };
  const logs: string[] = [];
  return resolveSalesRange(resolvedRequest, params.salesState ?? null, Date.now() + 1_000, logs, {
    today: params.today ?? new Date(),
    fetchAccountCreationDate: async () => params.accountCreationDate ?? null
  });
}

type IntervalMap = Record<SyncResource, IntervalRange[]>;

export async function runSync(request: SyncRequest): Promise<SyncResult> {
  const env = loadEnv();
  const logs: string[] = [];
  const stats: Record<string, number> = {};
  const configuredBudgetMs = env.SYNC_BUDGET_MS ?? 20_000;
  const safeBudgetMs = Math.min(Math.max(configuredBudgetMs, 0), MAX_SYNC_BUDGET_MS);
  if (safeBudgetMs < configuredBudgetMs) {
    logs.push(`budget_truncated:${configuredBudgetMs}:${safeBudgetMs}`);
  }
  const budgetEndsAt = Date.now() + safeBudgetMs;
  const pageSize = env.KFY_PAGE_SIZE ?? 200;

  const unsupportedResources = await getUnsupportedResources();
  const existingSalesState = (await getSalesSyncState()) ?? { lastPaidAt: null, lastCreatedAt: null };
  let salesState: SalesSyncState = existingSalesState;
  let salesStateChanged = false;

  const intervals = await resolveIntervals(request, salesState, budgetEndsAt, logs);
  const initialIntervalCounts = Object.fromEntries(
    RESOURCES.map((resource) => [resource, (intervals[resource] ?? []).length])
  ) as Record<SyncResource, number>;
  let cursor = normaliseCursor(request.cursor, intervals);
  const initialCursorOffsets = Object.fromEntries(
    RESOURCES.map((resource) => [resource, 0])
  ) as Record<SyncResource, number>;
  initialCursorOffsets[cursor.resource] = cursor.intervalIndex;

  if (!hasAnyIntervals(intervals)) {
    return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
  }

  if (cursor.done) {
    return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
  }

  const windowCounters = new Map<string, number>();

  try {
    while (Date.now() < budgetEndsAt) {
      const resourceIntervals = intervals[cursor.resource] ?? [];
      if (resourceIntervals.length === 0) {
        cursor = advanceCursor(cursor, intervals);
        if (cursor.done) {
          return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
        }
        continue;
      }

      const interval = resourceIntervals[cursor.intervalIndex] ?? null;
      if (!interval) {
        cursor = advanceCursor(cursor, intervals, interval);
        if (cursor.done) {
          return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
        }
        continue;
      }

      if (interval.start.getTime() > interval.end.getTime()) {
        logs.push(
          `interval_skip:${cursor.resource}:${formatDateOnly(interval.start)}:${formatDateOnly(interval.end)}`
        );
        cursor = advanceCursor(cursor, intervals, interval);
        if (cursor.done) {
          return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
        }
        continue;
      }

      if (unsupportedResources.has(cursor.resource)) {
        logs.push(`resource_unsupported_skip:${cursor.resource}`);
        cursor = advanceCursor(cursor, intervals, interval);
        if (cursor.done) {
          return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
        }
        continue;
      }

      const resourceConfig = RESOURCE_CONFIG[cursor.resource];
      if (!resourceConfig) {
        logs.push(`Configuração ausente para recurso ${cursor.resource}`);
        return finalize(false, false, cursor, stats, logs, request.persist, salesState, salesStateChanged);
      }

      const windowKey = buildWindowKey(cursor.resource, interval);
      const searchParams = new URLSearchParams({
        page_number: String(cursor.page),
        page_size: String(pageSize)
      });

      if (resourceConfig.supportsRange) {
        if (cursor.resource === 'sales') {
          searchParams.set('start_date', formatDateOnly(interval.start));
          searchParams.set('end_date', formatDateOnly(interval.end));
        } else {
          searchParams.set('start_date', interval.start.toISOString());
          searchParams.set('end_date', interval.end.toISOString());
        }
      }

      logs.push(`sync_request:${cursor.resource}:${cursor.page}:${cursor.intervalIndex}`);

      let response: Response;
      try {
        response = await kiwifyFetch(`${resourceConfig.path}?${searchParams.toString()}`, {
          budgetEndsAt
        });
      } catch (error) {
        if (cursor.resource === 'sales' && error instanceof KiwifyHttpError && error.status === 400) {
          const result = handleSalesBadRequest(error, cursor, interval, intervals, logs, windowKey, windowCounters);
          cursor = result.cursor;
          if (result.action === 'retry') {
            continue;
          }
          if (cursor.done) {
            return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
          }
          continue;
        }

        if (isUnsupportedResourceError(error)) {
          if (!unsupportedResources.has(cursor.resource)) {
            unsupportedResources.add(cursor.resource);
            await setUnsupportedResources(unsupportedResources);
          }
          logs.push(`resource_not_found_skip:${cursor.resource}`);
          cursor = advanceCursor(cursor, intervals, interval);
          if (cursor.done) {
            return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
          }
          continue;
        }

        logs.push(`Falha ao sincronizar ${cursor.resource}: ${(error as Error).message ?? String(error)}`);
        return finalize(false, false, cursor, stats, logs, request.persist, salesState, salesStateChanged);
      }

      const json = (await response.json()) as UnknownRecord;
      const page = parsePage(json, cursor.page);

      if (cursor.resource === 'sales') {
        const derivedCustomers: CustomerRow[] = [];
        for (const item of page.items) {
          const customerRow = mapCustomerFromSalePayload(item, {
            onInvalidCustomerId: (rawId) => {
              const saleId = normalizeExternalId((item.id ?? item.uuid) as unknown);
              logs.push(
                JSON.stringify({
                  event: 'customer_missing_id',
                  sale_id: saleId ?? null,
                  customer_id: rawId ?? null
                })
              );
            }
          });
          if (customerRow) {
            derivedCustomers.push(customerRow);
          }
        }
        if (derivedCustomers.length > 0) {
          const affectedCustomers = await upsertDerivedCustomers(derivedCustomers);
          if (affectedCustomers > 0) {
            stats.customers = (stats.customers ?? 0) + affectedCustomers;
          }
        }
      }

      type MappedRow = ReturnType<typeof resourceConfig.mapper>;

      let mapped: MappedRow[] = page.items.map((item) => resourceConfig.mapper(item));

      if (cursor.resource === 'sales') {
        mapped = (await remapSaleCustomerIds(mapped as unknown as SaleRow[])) as unknown as MappedRow[];
      }

      let processedRows: readonly MappedRow[] = mapped;

      if (mapped.length > 0) {
        try {
          const affected = await resourceConfig.writer(mapped);
          if (affected > 0) {
            stats[cursor.resource] = (stats[cursor.resource] ?? 0) + affected;
          }
        } catch (error) {
          if (cursor.resource === 'sales' && isForeignKeyViolation(error)) {
            const supabaseError = error as SupabaseWriteError;
            logs.push(
              JSON.stringify({
                event: 'sales_fk_violation',
                source: 'sync',
                code: supabaseError.code,
                details: supabaseError.details ?? null,
                hint: supabaseError.hint ?? null
              })
            );
            const fallback = await retrySalesAfterCustomerUpsert(page.items, mapped as SaleRow[], logs);
            processedRows = fallback.processedRows as unknown as readonly MappedRow[];
            if (fallback.affected > 0) {
              stats.sales = (stats.sales ?? 0) + fallback.affected;
            }
          } else {
            throw error;
          }
        }
      }

      if (cursor.resource === 'sales') {
        windowCounters.set(windowKey, (windowCounters.get(windowKey) ?? 0) + processedRows.length);
        const update = extractSalesStateFromRows(processedRows as SaleRow[]);
        if (update) {
          const merged = mergeSalesState(salesState, update);
          if (merged.changed) {
            salesState = merged.state;
            salesStateChanged = true;
          }
        }
      }

      if (!page.hasMore) {
        resourceIntervals.splice(cursor.intervalIndex, 1);

        if (cursor.resource === 'sales') {
          const count = windowCounters.get(windowKey) ?? 0;
          logs.push(
            JSON.stringify({
              event: 'sales_window_processed',
              window: { start: formatDateOnly(interval.start), end: formatDateOnly(interval.end) },
              count
            })
          );
          windowCounters.delete(windowKey);
        }
        cursor = advanceCursor(cursor, intervals, interval);
        if (cursor.done) {
          return finalize(true, true, null, stats, logs, request.persist, salesState, salesStateChanged);
        }
        continue;
      }

      cursor = {
        ...cursor,
        page: page.nextPage ?? cursor.page + 1
      };

      if (Date.now() >= budgetEndsAt) {
        break;
      }
    }
  } catch (error) {
    logs.push(`Erro ao processar sync: ${(error as Error).message ?? String(error)}`);
    return finalize(false, false, cursor, stats, logs, request.persist, salesState, salesStateChanged);
  }

  if (!cursor.done) {
    cursor = prepareCursorForPersistence(cursor, intervals, initialIntervalCounts, initialCursorOffsets);
  }

  const done = cursor.done;
  const nextCursor = done ? null : cursor;
  return finalize(true, done, nextCursor, stats, logs, request.persist, salesState, salesStateChanged);
}

function normaliseCursor(cursor: SyncCursor | null | undefined, intervals: IntervalMap): SyncCursor {
  const firstResource = findFirstResourceWithIntervals(intervals);
  if (!firstResource) {
    return { resource: RESOURCES[0], page: 1, intervalIndex: 0, done: true };
  }

  const provided = cursor ?? {
    resource: firstResource,
    page: 1,
    intervalIndex: 0,
    done: false
  };

  const requestedResource = (provided as { resource?: string }).resource;
  const resource = isSupportedResource(requestedResource) ? requestedResource : firstResource;
  const actualResource = (intervals[resource] ?? []).length > 0 ? resource : firstResource;
  const resourceIntervals = intervals[actualResource] ?? [];
  const maxIndex = resourceIntervals.length > 0 ? resourceIntervals.length - 1 : 0;
  const intervalIndex = resourceIntervals.length > 0 ? Math.min(Math.max(provided.intervalIndex ?? 0, 0), maxIndex) : 0;
  const page = Math.max(1, provided.page ?? 1);
  return {
    resource: actualResource,
    page,
    intervalIndex,
    done: false
  };
}

async function resolveIntervals(
  request: SyncRequest,
  salesState: SalesSyncState | null,
  budgetEndsAt: number,
  logs: string[]
): Promise<IntervalMap> {
  const generic = resolveGenericIntervals(request);
  const intervals: IntervalMap = Object.fromEntries(
    RESOURCES.map((resource) => [resource, generic.map((interval) => ({
      start: new Date(interval.start),
      end: new Date(interval.end)
    }))])
  ) as IntervalMap;

  const salesRange = await resolveSalesRange(request, salesState, budgetEndsAt, logs);
  if (!salesRange) {
    intervals.sales = [];
    return intervals;
  }

  const windows = buildSalesWindows(salesRange.start, salesRange.end);
  const salesWindows = windows
    .map(({ start, end }) => ({ start: parseDateOnly(start) ?? salesRange.start, end: parseDateOnly(end) ?? salesRange.end }))
    .filter((interval) => interval.start.getTime() <= interval.end.getTime());

  intervals.sales = salesWindows;

  if (request.full) {
    for (const resource of RESOURCES) {
      if (resource === 'sales') {
        continue;
      }
      const config = RESOURCE_CONFIG[resource];
      if (!config?.supportsRange) {
        continue;
      }
      intervals[resource] = salesWindows.map((interval) => ({
        start: new Date(interval.start),
        end: new Date(interval.end)
      }));
    }
  }

  return intervals;
}

function resolveGenericIntervals(request: SyncRequest): IntervalRange[] {
  if (request.range) {
    const start = safeDate(request.range.startDate);
    const end = safeDate(request.range.endDate);
    if (start.getTime() > end.getTime()) {
      return [];
    }
    return [{ start, end }];
  }

  if (request.full) {
    const now = new Date();
    const end = new Date(now);
    const start = startOfUtcDay(addDays(end, -365));
    return [{ start, end }];
  }

  return buildDefaultIntervals();
}

interface ResolveSalesRangeOptions {
  readonly fetchAccountCreationDate?: (budgetEndsAt: number, logs: string[]) => Promise<Date | null>;
  readonly today?: Date;
}

async function resolveSalesRange(
  request: SyncRequest,
  salesState: SalesSyncState | null,
  budgetEndsAt: number,
  logs: string[],
  options: ResolveSalesRangeOptions = {}
): Promise<IntervalRange | null> {
  const today = startOfUtcDay(options.today ?? new Date());
  const resolveAccountDate = options.fetchAccountCreationDate ?? fetchAccountCreationDate;
  let start: Date | null = null;
  let end = today;

  if (request.range) {
    start = normalizeDateInput(request.range.startDate);
    end = normalizeDateInput(request.range.endDate) ?? today;
  } else {
    if (!request.full) {
      const latest = latestProcessedDate(salesState);
      if (latest) {
        start = addDays(latest, 1);
      }
    }

    if (!start) {
      const accountDate = await resolveAccountDate(budgetEndsAt, logs);
      if (accountDate) {
        start = accountDate;
      }
    }

    end = today;
  }

  if (!start) {
    start = addDays(today, -365);
  }

  if (end.getTime() > today.getTime()) {
    end = today;
  }

  const fiveYearsAgo = addDays(today, -5 * 365);
  if (start.getTime() < fiveYearsAgo.getTime()) {
    start = fiveYearsAgo;
  }

  if (start.getTime() > end.getTime()) {
    return null;
  }

  return { start, end };
}

function safeDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function hasAnyIntervals(intervals: IntervalMap): boolean {
  return RESOURCES.some((resource) => (intervals[resource] ?? []).length > 0);
}

function findFirstResourceWithIntervals(intervals: IntervalMap): SyncResource | null {
  for (const resource of RESOURCES) {
    if ((intervals[resource] ?? []).length > 0) {
      return resource;
    }
  }
  return null;
}

function advanceCursor(
  current: SyncCursor,
  intervals: IntervalMap,
  previousInterval?: IntervalRange | null
): SyncCursor {
  const resourceIntervals = intervals[current.resource] ?? [];
  if (resourceIntervals.length > 0) {
    const intervalRemoved = previousInterval
      ? !resourceIntervals.includes(previousInterval)
      : false;

    if (intervalRemoved) {
      const nextIndex = Math.min(current.intervalIndex, resourceIntervals.length - 1);
      return {
        resource: current.resource,
        page: 1,
        intervalIndex: nextIndex,
        done: false
      };
    }

    if (current.intervalIndex + 1 < resourceIntervals.length) {
      return {
        resource: current.resource,
        page: 1,
        intervalIndex: current.intervalIndex + 1,
        done: false
      };
    }
  }

  const currentIndex = RESOURCES.indexOf(current.resource);
  for (let offset = 1; offset <= RESOURCES.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % RESOURCES.length;
    const nextResource = RESOURCES[nextIndex];
    if ((intervals[nextResource] ?? []).length > 0) {
      return { resource: nextResource, page: 1, intervalIndex: 0, done: false };
    }
  }

  return { resource: RESOURCES[0], page: 1, intervalIndex: 0, done: true };
}

function prepareCursorForPersistence(
  cursor: SyncCursor,
  intervals: IntervalMap,
  initialCounts: Record<SyncResource, number>,
  initialOffsets: Record<SyncResource, number>
): SyncCursor {
  const initialCount = initialCounts[cursor.resource] ?? 0;
  if (initialCount <= 0) {
    return cursor;
  }

  const remaining = (intervals[cursor.resource] ?? []).length;
  const removedThisRun = initialCount - remaining;
  const baseIndex = initialOffsets[cursor.resource] ?? 0;
  const processed = baseIndex + removedThisRun;
  if (processed <= baseIndex) {
    return cursor;
  }

  return { ...cursor, intervalIndex: processed };
}

function handleSalesBadRequest(
  error: KiwifyHttpError,
  cursor: SyncCursor,
  interval: IntervalRange,
  intervals: IntervalMap,
  logs: string[],
  windowKey: string,
  windowCounters: Map<string, number>
): { action: 'retry' | 'advance'; cursor: SyncCursor } {
  const window = { start: formatDateOnly(interval.start), end: formatDateOnly(interval.end) };
  logs.push(JSON.stringify({ event: 'sales_window_error', status: error.status, url: error.url, window, shrunk: false }));
  windowCounters.delete(windowKey);

  const shrunk = shrinkSalesInterval(intervals, cursor.resource, cursor.intervalIndex);
  if (shrunk) {
    logs.push(JSON.stringify({ event: 'sales_window_shrunk', status: error.status, url: error.url, window, shrunk: true }));
    return { action: 'retry', cursor: { ...cursor, page: 1 } };
  }

  logs.push(JSON.stringify({ event: 'sales_window_skipped', status: error.status, url: error.url, window, shrunk: false }));
  const nextCursor = advanceCursor(cursor, intervals, interval);
  return { action: 'advance', cursor: nextCursor };
}

function isForeignKeyViolation(error: unknown): error is SupabaseWriteError {
  return error instanceof SupabaseWriteError && error.code === '23503';
}

async function remapSaleCustomerIds(rows: readonly SaleRow[]): Promise<SaleRow[]> {
  if (rows.length === 0) {
    return [];
  }

  const customerIds = Array.from(
    new Set(rows.map((row) => row.customer_id).filter((id): id is string => Boolean(id)))
  );

  if (customerIds.length === 0) {
    return [...rows];
  }

  const resolvedIds = await resolveCustomerIds(customerIds);
  if (resolvedIds.size === 0) {
    return [...rows];
  }

  let changed = false;
  const remapped = rows.map((row) => {
    const original = row.customer_id;
    if (!original) {
      return row;
    }
    const resolved = resolvedIds.get(original) ?? original;
    if (resolved === original) {
      return row;
    }
    changed = true;
    return { ...row, customer_id: resolved };
  });

  return changed ? remapped : [...rows];
}

async function retrySalesAfterCustomerUpsert(
  pageItems: UnknownRecord[],
  salesRows: readonly SaleRow[],
  logs: string[]
): Promise<{ processedRows: SaleRow[]; affected: number }> {
  logs.push(JSON.stringify({ event: 'sales_fk_retry_triggered', source: 'sync', count: salesRows.length }));

  const derived = new Map<string, CustomerRow>();
  for (const item of pageItems) {
    const customerRow = mapCustomerFromSalePayload(item);
    if (customerRow) {
      derived.set(customerRow.id, customerRow);
    }
  }

  if (derived.size > 0) {
    await upsertDerivedCustomers(Array.from(derived.values()));
  }

  const remappedRows = await remapSaleCustomerIds(salesRows);
  const processed: SaleRow[] = [];

  for (const row of remappedRows) {
    try {
      await upsertSales([row]);
      processed.push(row);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        const payload = {
          event: 'fk_violation_after_retry',
          source: 'sync',
          sale_id: row.id ?? null,
          customer_id: row.customer_id ?? null
        };
        logs.push(JSON.stringify(payload));
        console.warn(JSON.stringify({ level: 'warn', ...payload, error: (error as Error).message ?? String(error) }));
        continue;
      }
      throw error;
    }
  }

  return { processedRows: processed, affected: processed.length };
}

function shrinkSalesInterval(intervals: IntervalMap, resource: SyncResource, intervalIndex: number): boolean {
  const resourceIntervals = intervals[resource] ?? [];
  const target = resourceIntervals[intervalIndex];
  if (!target) {
    return false;
  }

  const segments = splitInterval(target);
  if (segments.length <= 1) {
    return false;
  }

  resourceIntervals.splice(intervalIndex, 1, ...segments);
  intervals[resource] = resourceIntervals;
  return true;
}

function splitInterval(interval: IntervalRange): IntervalRange[] {
  const start = startOfUtcDay(interval.start);
  const end = startOfUtcDay(interval.end);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY) + 1;
  if (totalDays <= 1) {
    return [interval];
  }

  const halfDays = Math.ceil(totalDays / 2);
  const firstEnd = addDays(start, halfDays - 1);
  const secondStart = addDays(firstEnd, 1);
  const ranges: IntervalRange[] = [{ start, end: firstEnd }];
  if (secondStart.getTime() <= end.getTime()) {
    ranges.push({ start: secondStart, end });
  }
  return ranges;
}

function buildWindowKey(resource: SyncResource, interval: IntervalRange): string {
  return `${resource}:${formatDateOnly(interval.start)}:${formatDateOnly(interval.end)}`;
}

function mergeSalesState(
  current: SalesSyncState,
  update: SalesSyncState
): { state: SalesSyncState; changed: boolean } {
  let changed = false;
  let lastPaidAt = current.lastPaidAt;
  if (update.lastPaidAt && (!lastPaidAt || compareIsoDates(update.lastPaidAt, lastPaidAt) > 0)) {
    lastPaidAt = update.lastPaidAt;
    changed = true;
  }

  let lastCreatedAt = current.lastCreatedAt;
  if (update.lastCreatedAt && (!lastCreatedAt || compareIsoDates(update.lastCreatedAt, lastCreatedAt) > 0)) {
    lastCreatedAt = update.lastCreatedAt;
    changed = true;
  }

  if (!changed) {
    return { state: current, changed };
  }

  return { state: { lastPaidAt, lastCreatedAt }, changed };
}

function extractSalesStateFromRows(rows: readonly SaleRow[]): SalesSyncState | null {
  let lastPaidAt: string | null = null;
  let lastCreatedAt: string | null = null;

  for (const row of rows) {
    if (row.paid_at) {
      if (!lastPaidAt || compareIsoDates(row.paid_at, lastPaidAt) > 0) {
        lastPaidAt = row.paid_at;
      }
    }
    if (row.created_at) {
      if (!lastCreatedAt || compareIsoDates(row.created_at, lastCreatedAt) > 0) {
        lastCreatedAt = row.created_at;
      }
    }
  }

  if (!lastPaidAt && !lastCreatedAt) {
    return null;
  }

  return { lastPaidAt, lastCreatedAt };
}

function latestProcessedDate(state: SalesSyncState | null): Date | null {
  if (!state) {
    return null;
  }

  const dates: Date[] = [];
  if (state.lastPaidAt) {
    const parsed = new Date(state.lastPaidAt);
    if (!Number.isNaN(parsed.getTime())) {
      dates.push(startOfUtcDay(parsed));
    }
  }
  if (state.lastCreatedAt) {
    const parsed = new Date(state.lastCreatedAt);
    if (!Number.isNaN(parsed.getTime())) {
      dates.push(startOfUtcDay(parsed));
    }
  }

  if (dates.length === 0) {
    return null;
  }

  return dates.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

async function fetchAccountCreationDate(budgetEndsAt: number, logs: string[]): Promise<Date | null> {
  try {
    if (Date.now() >= budgetEndsAt) {
      return null;
    }
    const response = await kiwifyFetch('/v1/account-details', { budgetEndsAt });
    const payload = (await response.json()) as UnknownRecord;
    const candidates: Date[] = [];

    const mainCreated = extractDateField(payload, ['created_at', 'createdAt']);
    if (mainCreated) {
      candidates.push(mainCreated);
    }

    const legalEntities = payload.legal_entities ?? payload.legalEntities;
    if (Array.isArray(legalEntities)) {
      for (const entity of legalEntities) {
        if (entity && typeof entity === 'object') {
          const created = extractDateField(entity as UnknownRecord, ['created_at', 'createdAt']);
          if (created) {
            candidates.push(created);
          }
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const earliest = candidates.reduce((min, current) => (current.getTime() < min.getTime() ? current : min));
    const today = startOfUtcDay(new Date());
    const fiveYearsAgo = addDays(today, -5 * 365);
    return earliest.getTime() < fiveYearsAgo.getTime() ? fiveYearsAgo : earliest;
  } catch (error) {
    logs.push(`account_details_lookup_failed:${(error as Error).message ?? String(error)}`);
    return null;
  }
}

function extractDateField(payload: UnknownRecord, keys: readonly string[]): Date | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return startOfUtcDay(parsed);
      }
    }
  }
  return null;
}

function normalizeDateInput(value: string | Date): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return startOfUtcDay(value);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return startOfUtcDay(parsed);
  }
  return null;
}

function formatDateOnly(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

function parseDateOnly(value: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfUtcDay(parsed);
}

function startOfUtcDay(value: Date): Date {
  const copy = new Date(value);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addDays(value: Date, amount: number): Date {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function compareIsoDates(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return 0;
  }
  return Math.sign(leftTime - rightTime);
}

async function finalize(
  ok: boolean,
  done: boolean,
  nextCursor: SyncCursor | null,
  stats: Record<string, number>,
  logs: string[],
  persist: boolean | undefined,
  salesState: SalesSyncState,
  salesStateChanged: boolean
): Promise<SyncResult> {
  if (persist) {
    try {
      if (nextCursor) {
        await setSyncCursor(nextCursor);
      } else {
        await setSyncCursor({ resource: RESOURCES[0], page: 1, intervalIndex: 0, done });
      }
    } catch (error) {
      logs.push(`Falha ao persistir cursor: ${(error as Error).message ?? String(error)}`);
    }

    if (salesStateChanged) {
      try {
        await setSalesSyncState(salesState);
      } catch (error) {
        logs.push(`Falha ao persistir estado de vendas: ${(error as Error).message ?? String(error)}`);
      }
    }
  }

  return {
    ok,
    done,
    nextCursor,
    stats,
    logs
  };
}
