import { loadEnv } from '@/lib/env';
import { getServiceClient } from '@/lib/supabase';
import type {
  CouponRow,
  CustomerRow,
  EnrollmentRow,
  PayoutRow,
  ProductRow,
  RefundRow,
  SaleRow,
  SubscriptionRow
} from './mappers';
import { normalizeExternalId } from './ids';

const DEFAULT_BATCH_SIZE = 200;

type UpsertableRow =
  | ProductRow
  | CustomerRow
  | SaleRow
  | SubscriptionRow
  | EnrollmentRow
  | CouponRow
  | RefundRow
  | PayoutRow;

export class SupabaseWriteError extends Error {
  readonly table: string;
  readonly operation: 'upsert';
  readonly code: string | null;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(
    message: string,
    options: { table: string; code?: string | null; details?: string | null; hint?: string | null; cause?: unknown }
  ) {
    super(message, { cause: options.cause });
    this.table = options.table;
    this.operation = 'upsert';
    this.code = options.code ?? null;
    this.details = options.details ?? null;
    this.hint = options.hint ?? null;
  }
}

export function chunk<T>(input: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('chunk size must be positive');
  }
  const result: T[][] = [];
  for (let index = 0; index < input.length; index += size) {
    result.push(input.slice(index, index + size));
  }
  return result;
}

async function upsertRows<T extends UpsertableRow>(
  table: string,
  rows: readonly T[],
  onConflict: string = 'id'
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const env = loadEnv();
  const batchSize = Math.max(1, env.DB_UPSERT_BATCH ?? DEFAULT_BATCH_SIZE);
  const maxWriteMs = env.MAX_WRITE_MS ?? 15_000;
  const budgetEndsAt = Date.now() + maxWriteMs;
  const client = getServiceClient();
  let total = 0;

  for (const slice of chunk(rows, batchSize)) {
    if (Date.now() >= budgetEndsAt) {
      throw new Error(`Exceeded write budget while inserting into ${table}`);
    }

    const { error } = await client.from(table).upsert(slice, { onConflict });

    if (error) {
      if (table === 'kfy_customers') {
        const customerIds = slice
          .map((row) => {
            if (row && typeof row === 'object' && 'id' in row) {
              const id = (row as { id?: unknown }).id;
              return typeof id === 'string' && id ? id : null;
            }
            return null;
          })
          .filter((id): id is string => Boolean(id));

        const logPayload: Record<string, unknown> = {
          level: 'error',
          event: 'customer_write_failed',
          table,
          operation: 'upsert',
          customer_id: customerIds.length <= 1 ? customerIds[0] ?? null : customerIds,
          error
        };

        if (typeof error.message === 'string' && error.message.includes('cannot insert a non-DEFAULT value into column')) {
          logPayload.hint = 'column id must be non-identity / no default';
        }

        console.error(JSON.stringify(logPayload));
      }
      throw new SupabaseWriteError(
        `Failed to upsert into ${table}: ${error.message ?? 'unknown error'}`,
        {
          table,
          code: typeof error.code === 'string' ? error.code : null,
          details: typeof error.details === 'string' ? error.details : null,
          hint: typeof error.hint === 'string' ? error.hint : null,
          cause: error
        }
      );
    }

    total += slice.length;
  }

  return total;
}

export async function upsertProducts(rows: readonly ProductRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const client = getServiceClient();
  const uniqueExternalIds = Array.from(new Set(rows.map((row) => row.external_id).filter(Boolean)));

  let existingIds: Map<string, string> = new Map();
  if (uniqueExternalIds.length > 0) {
    const { data, error } = await client
      .from('kfy_products')
      .select('id, external_id')
      .in('external_id', uniqueExternalIds);

    if (error) {
      throw new Error(`Failed to load existing kfy_products: ${error.message ?? 'unknown error'}`);
    }

    existingIds = new Map((data ?? []).map((row) => [row.external_id as string, row.id as string]));
  }

  const normalisedRows = rows.map((row) => {
    const existingId = existingIds.get(row.external_id);
    if (!existingId) {
      return row;
    }
    return { ...row, id: existingId };
  });

  return upsertRows('kfy_products', normalisedRows, 'external_id');
}

function normalizeCustomerRow(row: CustomerRow): CustomerRow | null {
  const normalizedExternalId = normalizeExternalId(row.external_id ?? row.id);
  if (!normalizedExternalId) {
    return null;
  }

  const normalizedId = normalizeExternalId(row.id) ?? normalizedExternalId;

  if (row.id === normalizedId && row.external_id === normalizedExternalId) {
    return row;
  }

  return { ...row, id: normalizedId, external_id: normalizedExternalId };
}

function ensureExistingCustomerIds(
  rows: readonly CustomerRow[],
  existingIds: Map<string, string>
): CustomerRow[] {
  if (existingIds.size === 0) {
    return [...rows];
  }

  return rows.map((row) => {
    const existingId = existingIds.get(row.external_id);
    if (!existingId || existingId === row.id) {
      return row;
    }
    return { ...row, id: existingId };
  });
}

export async function loadExistingCustomerIds(externalIds: readonly string[]): Promise<Map<string, string>> {
  if (externalIds.length === 0) {
    return new Map();
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from('kfy_customers')
    .select('id, external_id')
    .in('external_id', externalIds);

  if (error) {
    throw new Error(`Failed to load existing kfy_customers: ${error.message ?? 'unknown error'}`);
  }

  return new Map((data ?? []).map((row) => [row.external_id as string, row.id as string]));
}

export async function upsertCustomers(rows: readonly CustomerRow[]): Promise<number> {
  const normalized = rows
    .map((row) => normalizeCustomerRow(row))
    .filter((row): row is CustomerRow => row !== null);
  if (normalized.length === 0) {
    return 0;
  }

  const uniqueExternalIds = Array.from(new Set(normalized.map((row) => row.external_id).filter(Boolean)));
  const existingIds = await loadExistingCustomerIds(uniqueExternalIds);
  const preparedRows = prepareCustomerUpsertRows(normalized, existingIds);

  return upsertRows('kfy_customers', preparedRows, 'id');
}

export async function upsertCustomer(row: CustomerRow | null | undefined): Promise<number> {
  if (!row) {
    return 0;
  }
  return upsertCustomers([row]);
}

export async function upsertDerivedCustomers(
  rows: readonly (CustomerRow | null | undefined)[]
): Promise<number> {
  const unique = new Map<string, CustomerRow>();
  for (const row of rows) {
    if (!row) {
      continue;
    }
    const normalized = normalizeCustomerRow(row);
    if (normalized) {
      unique.set(normalized.id, normalized);
    }
  }
  if (unique.size === 0) {
    return 0;
  }
  return upsertCustomers(Array.from(unique.values()));
}

export function prepareCustomerUpsertRows(
  rows: readonly CustomerRow[],
  existingIds: Map<string, string>
): CustomerRow[] {
  if (rows.length === 0) {
    return [];
  }

  return ensureExistingCustomerIds(rows, existingIds);
}

export function upsertSales(rows: readonly SaleRow[]): Promise<number> {
  return upsertRows('kfy_sales', rows);
}

export async function resolveCustomerIds(externalIds: readonly string[]): Promise<Map<string, string>> {
  const uniqueExternalIds = Array.from(new Set(externalIds.filter((id): id is string => Boolean(id))));
  if (uniqueExternalIds.length === 0) {
    return new Map();
  }

  const existingIds = await loadExistingCustomerIds(uniqueExternalIds);
  if (existingIds.size === 0) {
    return new Map(uniqueExternalIds.map((id) => [id, id]));
  }

  return new Map(uniqueExternalIds.map((id) => [id, existingIds.get(id) ?? id]));
}

export function upsertSubscriptions(rows: readonly SubscriptionRow[]): Promise<number> {
  return upsertRows('kfy_subscriptions', rows);
}

export function upsertEnrollments(rows: readonly EnrollmentRow[]): Promise<number> {
  return upsertRows('kfy_enrollments', rows);
}

export function upsertCoupons(rows: readonly CouponRow[]): Promise<number> {
  return upsertRows('kfy_coupons', rows);
}

export function upsertRefunds(rows: readonly RefundRow[]): Promise<number> {
  return upsertRows('kfy_refunds', rows);
}

export function upsertPayouts(rows: readonly PayoutRow[]): Promise<number> {
  return upsertRows('kfy_payouts', rows);
}
