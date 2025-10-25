import { loadEnv } from '@/lib/env';
import { kiwifyFetch } from './http';
import {
  mapCouponPayload,
  mapCustomerPayload,
  mapEnrollmentPayload,
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
import {
  upsertCoupons,
  upsertCustomers,
  upsertEnrollments,
  upsertPayouts,
  upsertProducts,
  upsertRefunds,
  upsertSales,
  upsertSubscriptions
} from './writes';
import { setSyncCursor } from './syncState';

const DAY = 24 * 60 * 60 * 1000;

const RESOURCES = [
  'products',
  'customers',
  'sales',
  'subscriptions',
  'enrollments',
  'coupons',
  'refunds',
  'payouts'
] as const;

export type SyncResource = (typeof RESOURCES)[number];

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
  customers: {
    path: '/v1/customers',
    mapper: mapCustomerPayload,
    writer: upsertCustomers,
    supportsRange: true
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

export function buildDefaultIntervals(): IntervalRange[] {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY);
  return [
    { start: ninetyDaysAgo, end: now },
    { start: todayStart, end: now }
  ];
}

export async function runSync(request: SyncRequest): Promise<SyncResult> {
  const env = loadEnv();
  const logs: string[] = [];
  const stats: Record<string, number> = {};
  const budgetEndsAt = Date.now() + (env.SYNC_BUDGET_MS ?? 20_000);
  const intervals = resolveIntervals(request);
  let cursor = normaliseCursor(request.cursor, intervals.length);

  if (cursor.done) {
    return finalize(true, true, null, stats, logs, request.persist);
  }

  const pageSize = env.KFY_PAGE_SIZE ?? 200;

  try {
    while (Date.now() < budgetEndsAt) {
      const resourceConfig = RESOURCE_CONFIG[cursor.resource];
      if (!resourceConfig) {
        logs.push(`Configuração ausente para recurso ${cursor.resource}`);
        return finalize(false, false, cursor, stats, logs, request.persist);
      }

      const interval = intervals[cursor.intervalIndex] ?? intervals[intervals.length - 1] ?? null;
      const searchParams = new URLSearchParams({
        page_number: String(cursor.page),
        page_size: String(pageSize)
      });

      if (resourceConfig.supportsRange && interval) {
        searchParams.set('start_date', interval.start.toISOString());
        searchParams.set('end_date', interval.end.toISOString());
      }

      logs.push(`Sync ${cursor.resource} página ${cursor.page} intervalo ${cursor.intervalIndex}`);

      const response = await kiwifyFetch(`${resourceConfig.path}?${searchParams.toString()}`, {
        budgetEndsAt
      });

      if (!response.ok) {
        const message = await safeReadText(response);
        logs.push(`Falha ${response.status} ao sincronizar ${cursor.resource}: ${message}`);
        return finalize(false, false, cursor, stats, logs, request.persist);
      }

      const json = (await response.json()) as UnknownRecord;
      const page = parsePage(json, cursor.page);
      const mapped = page.items.map((item) => resourceConfig.mapper(item));

      if (mapped.length > 0) {
        const affected = await resourceConfig.writer(mapped);
        if (affected > 0) {
          stats[cursor.resource] = (stats[cursor.resource] ?? 0) + affected;
        }
      }

      if (!page.hasMore) {
        cursor = advanceCursor(cursor, intervals.length);
        if (cursor.done) {
          return finalize(true, true, null, stats, logs, request.persist);
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
    return finalize(false, false, cursor, stats, logs, request.persist);
  }

  const done = cursor.done;
  const nextCursor = done ? null : cursor;
  return finalize(true, done, nextCursor, stats, logs, request.persist);
}

function normaliseCursor(cursor: SyncCursor | null | undefined, intervalsLength: number): SyncCursor {
  const base: SyncCursor = cursor ?? {
    resource: RESOURCES[0],
    page: 1,
    intervalIndex: 0,
    done: false
  };

  if (base.intervalIndex >= intervalsLength) {
    return {
      ...base,
      intervalIndex: Math.max(0, intervalsLength - 1)
    };
  }
  return base;
}

function resolveIntervals(request: SyncRequest): IntervalRange[] {
  if (request.full) {
    const now = new Date();
    return [
      {
        start: new Date(0),
        end: now
      }
    ];
  }

  if (request.range) {
    const start = safeDate(request.range.startDate);
    const end = safeDate(request.range.endDate);
    return [
      {
        start,
        end
      }
    ];
  }

  return buildDefaultIntervals();
}

function safeDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function advanceCursor(current: SyncCursor, intervalsLength: number): SyncCursor {
  if (intervalsLength === 0) {
    return { ...current, done: true };
  }

  const resourceIndex = RESOURCES.indexOf(current.resource);
  const hasNextInterval = current.intervalIndex + 1 < intervalsLength;

  if (hasNextInterval) {
    return {
      resource: current.resource,
      page: 1,
      intervalIndex: current.intervalIndex + 1,
      done: false
    };
  }

  if (resourceIndex >= 0 && resourceIndex + 1 < RESOURCES.length) {
    return {
      resource: RESOURCES[resourceIndex + 1],
      page: 1,
      intervalIndex: 0,
      done: false
    };
  }

  return {
    resource: RESOURCES[0],
    page: 1,
    intervalIndex: 0,
    done: true
  };
}

function parsePage(payload: UnknownRecord, fallbackPage: number): ParsedPage {
  const items = extractItems(payload);
  const pagination = extractPagination(payload);
  const page = pagination.page ?? fallbackPage;
  const totalPages = pagination.totalPages;
  const hasMore = determineHasMore(payload, page, totalPages);
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
  const totalPages = chooseNumber([payload.total_pages, payload.totalPages, meta?.total_pages]);
  const nextPage = chooseNumber([payload.next_page, payload.nextPage, meta?.next_page]);
  return {
    page: page ?? null,
    totalPages: totalPages ?? null,
    nextPage: nextPage ?? null
  };
}

function determineHasMore(payload: UnknownRecord, page: number | null, totalPages: number | null): boolean {
  if (typeof payload.has_more === 'boolean') {
    return payload.has_more;
  }
  const meta = (payload.meta as UnknownRecord | undefined)?.pagination as UnknownRecord | undefined;
  if (meta && typeof meta.has_more === 'boolean') {
    return meta.has_more;
  }
  if (page !== null && totalPages !== null) {
    return page < totalPages;
  }
  if (payload.next_page !== undefined || payload.nextPage !== undefined) {
    return true;
  }
  return false;
}

function chooseNumber(candidates: Array<unknown>): number | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function finalize(
  ok: boolean,
  done: boolean,
  nextCursor: SyncCursor | null,
  stats: Record<string, number>,
  logs: string[],
  persist: boolean | undefined
): Promise<SyncResult> {
  if (persist) {
    try {
      if (nextCursor) {
        await setSyncCursor(nextCursor);
      } else {
        await setSyncCursor({ resource: RESOURCES[0], page: 1, intervalIndex: 0, done: done });
      }
    } catch (error) {
      logs.push(`Falha ao persistir cursor: ${(error as Error).message ?? String(error)}`);
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
