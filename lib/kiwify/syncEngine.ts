import { loadEnv } from '@/lib/env';
import { KiwifyHttpError, kiwifyFetch } from './http';
import {
  mapCouponPayload,
  mapCustomerFromSalePayload,
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
import { normalizeExternalId } from './ids';
import {
  SupabaseWriteError,
  resolveCustomerIds,
  upsertCoupons,
  upsertCustomers,
  upsertDerivedCustomers,
  upsertEnrollments,
  upsertPayouts,
  upsertProducts,
  upsertRefunds,
  upsertSales,
  upsertSubscriptions
} from './writes';
import { setSyncMetadata } from './syncState';

const MAX_SYNC_BUDGET_MS = 295_000;
const DEFAULT_PAGE_SIZE = 200;

export const RESOURCES = [
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

export interface SyncRequest {
  readonly resources?: readonly SyncResource[] | null;
  readonly since?: string | null;
  readonly until?: string | null;
  readonly pageSize?: number | null;
  readonly persist?: boolean;
}

export interface SyncResult {
  readonly ok: boolean;
  readonly done: boolean;
  readonly nextCursor: null;
  readonly stats: Record<string, number>;
  readonly logs: readonly string[];
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
  products: { path: '/v1/products', mapper: mapProductPayload, writer: upsertProducts, supportsRange: true },
  customers: { path: '/v1/customers', mapper: mapCustomerPayload, writer: upsertCustomers, supportsRange: true },
  sales: { path: '/v1/sales', mapper: mapSalePayload, writer: upsertSales, supportsRange: true },
  subscriptions: {
    path: '/v1/subscriptions',
    mapper: mapSubscriptionPayload,
    writer: upsertSubscriptions,
    supportsRange: true
  },
  enrollments: { path: '/v1/enrollments', mapper: mapEnrollmentPayload, writer: upsertEnrollments, supportsRange: true },
  coupons: { path: '/v1/coupons', mapper: mapCouponPayload, writer: upsertCoupons, supportsRange: true },
  refunds: { path: '/v1/refunds', mapper: mapRefundPayload, writer: upsertRefunds, supportsRange: true },
  payouts: { path: '/v1/payouts', mapper: mapPayoutPayload, writer: upsertPayouts, supportsRange: true }
};

interface FetchOptions {
  readonly resource: SyncResource;
  readonly config: ResourceConfig<any>;
  readonly pageSize: number;
  readonly since: Date | null;
  readonly until: Date | null;
  readonly budgetEndsAt: number;
  readonly logs: string[];
}

export async function runSync(request: SyncRequest = {}): Promise<SyncResult> {
  const env = loadEnv();
  const budgetEndsAt = Date.now() + Math.min(env.SYNC_BUDGET_MS ?? MAX_SYNC_BUDGET_MS, MAX_SYNC_BUDGET_MS);
  const logs: string[] = [];
  const stats: Record<string, number> = {};

  const resources = normaliseResources(request.resources);
  const pageSize = Math.max(1, Math.min(request.pageSize ?? env.KFY_PAGE_SIZE ?? DEFAULT_PAGE_SIZE, 500));
  const since = parseDate(request.since);
  const until = parseDate(request.until);

  try {
    for (const resource of resources) {
      const config = RESOURCE_CONFIG[resource];
      if (!config) {
        logs.push(`resource_skip:${resource}:config_missing`);
        continue;
      }

      logs.push(`resource_start:${resource}`);
      const rawItems = await fetchResourceItems({
        resource,
        config,
        pageSize,
        since: config.supportsRange ? since : null,
        until: config.supportsRange ? until : null,
        budgetEndsAt,
        logs
      });

      if (rawItems.length === 0) {
        logs.push(`resource_empty:${resource}`);
        continue;
      }

      if (resource === 'sales') {
        const derivedCustomers = collectCustomersFromSales(rawItems, logs);
        if (derivedCustomers.length > 0) {
          const affected = await upsertDerivedCustomers(derivedCustomers);
          if (affected > 0) {
            stats.customers = (stats.customers ?? 0) + affected;
          }
        }

        const derivedProducts = collectProductsFromSales(rawItems);
        if (derivedProducts.length > 0) {
          const affected = await upsertProducts(derivedProducts);
          if (affected > 0) {
            stats.products = (stats.products ?? 0) + affected;
          }
        }
      }

      type Row = ReturnType<typeof config.mapper>;
      let rows: Row[] = rawItems.map((item) => config.mapper(item));

      if (resource === 'sales') {
        rows = (await resolveSaleCustomerIds(rows as unknown as SaleRow[])) as unknown as Row[];
      }

      if (rows.length === 0) {
        logs.push(`resource_skip:${resource}:no_rows`);
        continue;
      }

      try {
        const affected = await config.writer(rows);
        if (affected > 0) {
          stats[resource] = (stats[resource] ?? 0) + affected;
        }
      } catch (error) {
        if (resource === 'sales' && isForeignKeyViolation(error)) {
          logs.push('sales_retry_after_fk_violation');
          const remapped = await resolveSaleCustomerIds(rows as unknown as SaleRow[]);
          const affected = await config.writer(remapped as unknown as Row[]);
          if (affected > 0) {
            stats[resource] = (stats[resource] ?? 0) + affected;
          }
        } else {
          throw error;
        }
      }

      logs.push(`resource_done:${resource}`);
    }

    if (request.persist) {
      await setSyncMetadata({
        lastRunAt: new Date().toISOString(),
        resources: resources.length === RESOURCES.length ? null : resources,
        since: since?.toISOString() ?? null,
        until: until?.toISOString() ?? null
      });
    }

    logs.push('sync_complete');
    return { ok: true, done: true, nextCursor: null, stats, logs };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`sync_failed:${message}`);
    return { ok: false, done: true, nextCursor: null, stats, logs };
  }
}

async function fetchResourceItems(options: FetchOptions): Promise<UnknownRecord[]> {
  const { resource, config, pageSize, since, until, budgetEndsAt, logs } = options;
  const items: UnknownRecord[] = [];
  let page = 1;

  while (Date.now() < budgetEndsAt) {
    const searchParams = new URLSearchParams({
      page_number: String(page),
      page_size: String(pageSize)
    });

    if (since) {
      searchParams.set('start_date', resource === 'sales' ? formatDateOnly(since) : since.toISOString());
    }
    if (until) {
      searchParams.set('end_date', resource === 'sales' ? formatDateOnly(until) : until.toISOString());
    }

    logs.push(`sync_request:${resource}:${page}`);

    let response: Response;
    try {
      response = await kiwifyFetch(`${config.path}?${searchParams.toString()}`, {
        budgetEndsAt
      });
    } catch (error) {
      if (error instanceof KiwifyHttpError && error.status === 404) {
        logs.push(`resource_not_found:${resource}`);
        return [];
      }
      throw error;
    }

    const payload = (await response.json()) as UnknownRecord;
    const parsed = parsePage(payload, page);

    items.push(...parsed.items);

    if (!parsed.hasMore || !parsed.nextPage || parsed.nextPage <= page) {
      break;
    }

    page = parsed.nextPage;
  }

  return items;
}

function parsePage(payload: UnknownRecord, fallbackPage: number): {
  readonly items: UnknownRecord[];
  readonly hasMore: boolean;
  readonly nextPage: number | null;
} {
  const items = extractItems(payload);
  const pagination = extractPagination(payload);
  const page = pagination.page ?? fallbackPage;
  const totalPages = pagination.totalPages;
  const hasMore = determineHasMore(payload, page, totalPages, pagination.nextPage);
  const nextPage = hasMore ? pagination.nextPage ?? page + 1 : null;
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
  const nextPage = chooseNumber([
    payload.next_page,
    payload.nextPage,
    meta?.next_page,
    meta?.nextPage,
    payload.page_number && payload.page_size && payload.total ?
      Math.ceil(Number(payload.total) / Number(payload.page_size)) > Number(payload.page_number)
        ? Number(payload.page_number) + 1
        : null
      : null
  ]);
  return {
    page: page ?? null,
    totalPages: totalPages ?? null,
    nextPage: nextPage ?? null
  };
}

function determineHasMore(
  payload: UnknownRecord,
  page: number,
  totalPages: number | null,
  nextPage: number | null
): boolean {
  if (typeof payload.has_more === 'boolean') {
    return payload.has_more;
  }
  if (typeof payload.hasMore === 'boolean') {
    return payload.hasMore;
  }
  if (typeof nextPage === 'number') {
    return nextPage > page;
  }
  if (typeof totalPages === 'number') {
    return page < totalPages;
  }
  return false;
}

function chooseNumber(values: readonly unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function formatDateOnly(value: Date): string {
  const copy = new Date(value);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp);
}

function normaliseResources(resources: SyncRequest['resources']): SyncResource[] {
  if (!resources || resources.length === 0) {
    return [...RESOURCES];
  }

  const unique = new Set<SyncResource>();
  for (const candidate of resources) {
    if (isSupportedResource(candidate)) {
      unique.add(candidate);
    }
  }

  return unique.size > 0 ? Array.from(unique) : [...RESOURCES];
}

function isSupportedResource(value: unknown): value is SyncResource {
  return typeof value === 'string' && (RESOURCES as readonly string[]).includes(value);
}

function collectCustomersFromSales(items: readonly UnknownRecord[], logs: string[]): CustomerRow[] {
  const customers: CustomerRow[] = [];
  for (const item of items) {
    const customer = mapCustomerFromSalePayload(item, {
      onInvalidCustomerId: (rawId) => {
        const saleId = normalizeExternalId((item.id ?? item.uuid) as unknown);
        logs.push(
          JSON.stringify({
            event: 'customer_missing_id',
            source: 'sync',
            sale_id: saleId ?? null,
            customer_id: rawId ?? null
          })
        );
      }
    });
    if (customer) {
      customers.push(customer);
    }
  }
  return customers;
}

function collectProductsFromSales(items: readonly UnknownRecord[]): ProductRow[] {
  const products = new Map<string, ProductRow>();
  for (const item of items) {
    const row = mapProductFromSale(item);
    if (row) {
      products.set(row.id, row);
    }
  }
  return Array.from(products.values());
}

function mapProductFromSale(payload: UnknownRecord): ProductRow | null {
  const nested = (payload.product as UnknownRecord | undefined) ?? (payload.offer as UnknownRecord | undefined);
  const rawId =
    nested?.id ??
    nested?.uuid ??
    payload.product_id ??
    payload.productId ??
    payload.offer_id ??
    payload.offerId ??
    null;

  if (!rawId) {
    return null;
  }

  const product: UnknownRecord = { ...(nested ?? {}) };
  product.id = product.id ?? product.uuid ?? rawId;
  product.uuid = product.uuid ?? rawId;
  product.title = product.title ?? payload.product_title ?? payload.productTitle ?? payload.offer_title ?? null;
  product.price = product.price ?? payload.product_price ?? payload.total_amount ?? payload.amount ?? null;
  product.currency = product.currency ?? payload.currency ?? payload.currency_code ?? null;
  product.active = product.active ?? true;
  product.created_at = product.created_at ?? payload.created_at ?? payload.createdAt ?? null;
  product.updated_at = product.updated_at ?? payload.updated_at ?? payload.updatedAt ?? null;

  try {
    return mapProductPayload(product);
  } catch {
    return null;
  }
}

async function resolveSaleCustomerIds(rows: readonly SaleRow[]): Promise<SaleRow[]> {
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id).filter((id): id is string => Boolean(id))));
  if (customerIds.length === 0) {
    return [...rows];
  }
  const resolved = await resolveCustomerIds(customerIds);
  if (resolved.size === 0) {
    return [...rows];
  }

  return rows.map((row) => {
    if (!row.customer_id) {
      return row;
    }
    const mapped = resolved.get(row.customer_id);
    if (!mapped || mapped === row.customer_id) {
      return row;
    }
    return { ...row, customer_id: mapped };
  });
}

function isForeignKeyViolation(error: unknown): error is SupabaseWriteError {
  return error instanceof SupabaseWriteError && error.code === '23503';
}
