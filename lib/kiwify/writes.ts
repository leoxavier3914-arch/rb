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

    const { error } = await client
      .from(table)
      .upsert(slice, { onConflict });

    if (error) {
      throw new Error(`Failed to upsert into ${table}: ${error.message ?? 'unknown error'}`);
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

export function upsertCustomers(rows: readonly CustomerRow[]): Promise<number> {
  return upsertRows('kfy_customers', rows);
}

export function upsertSales(rows: readonly SaleRow[]): Promise<number> {
  return upsertRows('kfy_sales', rows);
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
