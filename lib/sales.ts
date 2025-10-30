import { getServiceClient } from '@/lib/supabase';

export interface SaleRow {
  readonly id: string;
  readonly status: string | null;
  readonly product_id: string | null;
  readonly product_title: string | null;
  readonly customer_id: string | null;
  readonly customer_name: string | null;
  readonly customer_email: string | null;
  readonly total_amount_cents: number | null;
  readonly net_amount_cents: number | null;
  readonly fee_amount_cents: number | null;
  readonly currency: string | null;
  readonly installments: number | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
  readonly updated_at: string | null;
  readonly synced_at: string | null;
}

export interface SalesPage {
  readonly items: readonly SaleRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface SalesSummary {
  readonly totalSales: number;
  readonly grossAmountCents: number;
  readonly netAmountCents: number;
  readonly feeAmountCents: number;
  readonly lastSaleAt: string | null;
  readonly lastSyncedAt: string | null;
}

export interface DailySalesRow {
  readonly saleDate: string;
  readonly totalSales: number;
  readonly grossAmountCents: number;
  readonly netAmountCents: number;
}

export interface UpsertSaleInput {
  readonly id: string;
  readonly status: string | null;
  readonly product_id: string | null;
  readonly product_title: string | null;
  readonly customer_id: string | null;
  readonly customer_name: string | null;
  readonly customer_email: string | null;
  readonly total_amount_cents: number | null;
  readonly net_amount_cents: number | null;
  readonly fee_amount_cents: number | null;
  readonly currency: string | null;
  readonly installments: number | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
  readonly updated_at: string | null;
  readonly raw: Record<string, unknown>;
}

const UPSERT_BATCH_SIZE = 500;

export async function listSales(
  page: number,
  pageSize: number,
  statuses?: readonly string[],
  searchTerm?: string
): Promise<SalesPage> {
  const client = getServiceClient();
  const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const limit = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;
  const from = (currentPage - 1) * limit;
  const to = from + limit - 1;
  const appliedStatuses = statuses?.length ? statuses : ['paid'];

  let query = client
    .from('sales')
    .select(
      `
        id,
        status,
        product_id,
        product_title,
        customer_id,
        customer_name,
        customer_email,
        total_amount_cents,
        net_amount_cents,
        fee_amount_cents,
        currency,
        installments,
        created_at,
        paid_at,
        updated_at,
        synced_at
      `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false, nullsFirst: false });

  if (appliedStatuses.length === 1) {
    query = query.eq('status', appliedStatuses[0]);
  } else {
    query = query.in('status', appliedStatuses as string[]);
  }

  const normalizedSearch =
    typeof searchTerm === 'string' && searchTerm.trim().length > 0
      ? searchTerm.trim()
      : undefined;

  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replace(/[%_]/g, character => `\\${character}`);
    const pattern = `%${escapedSearch}%`;
    query = query.or(
      [
        `id.ilike.${pattern}`,
        `customer_name.ilike.${pattern}`,
        `customer_email.ilike.${pattern}`
      ].join(',')
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []) as SaleRow[],
    total: typeof count === 'number' ? count : 0,
    page: currentPage,
    pageSize: limit
  };
}

export async function listDailySales(): Promise<DailySalesRow[]> {
  const client = getServiceClient();

  type DailySaleSourceRow = {
    readonly created_at: string | null;
    readonly total_amount_cents: number | null;
    readonly net_amount_cents: number | null;
  };

  const { data, error } = await client
    .from('sales')
    .select('created_at,total_amount_cents,net_amount_cents')
    .eq('status', 'paid')
    .order('created_at', { ascending: true, nullsFirst: false })
    .returns<DailySaleSourceRow[]>();

  if (error) {
    throw error;
  }

  const aggregate = new Map<
    string,
    { totalSales: number; grossAmountCents: number; netAmountCents: number }
  >();

  for (const row of data ?? []) {
    if (typeof row.created_at !== 'string' || row.created_at.length === 0) {
      continue;
    }

    const saleDate = row.created_at.slice(0, 10);
    const gross = Number(row.total_amount_cents ?? 0);
    const net = Number(row.net_amount_cents ?? 0);

    const current =
      aggregate.get(saleDate) ?? {
        totalSales: 0,
        grossAmountCents: 0,
        netAmountCents: 0
      };

    current.totalSales += 1;
    current.grossAmountCents += Number.isFinite(gross) ? gross : 0;
    current.netAmountCents += Number.isFinite(net) ? net : 0;

    aggregate.set(saleDate, current);
  }

  return Array.from(aggregate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([saleDate, totals]) => ({
      saleDate,
      totalSales: totals.totalSales,
      grossAmountCents: totals.grossAmountCents,
      netAmountCents: totals.netAmountCents
    }));
}

export async function getSalesSummary(): Promise<SalesSummary> {
  const client = getServiceClient();
  const { data, error } = await client.from('sales_summary').select('*').maybeSingle();
  if (error) {
    throw error;
  }

  const summary = data ?? {};
  return {
    totalSales: Number(summary.total_sales ?? 0),
    grossAmountCents: Number(summary.gross_amount_cents ?? 0),
    netAmountCents: Number(summary.net_amount_cents ?? 0),
    feeAmountCents: Number(summary.fee_amount_cents ?? 0),
    lastSaleAt: typeof summary.last_sale_at === 'string' ? summary.last_sale_at : null,
    lastSyncedAt: typeof summary.last_synced_at === 'string' ? summary.last_synced_at : null
  };
}

export async function upsertSales(rows: readonly UpsertSaleInput[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const client = getServiceClient();
  const syncedAt = new Date().toISOString();
  const payload = rows.map(row => ({
    ...row,
    synced_at: syncedAt
  }));

  for (let index = 0; index < payload.length; index += UPSERT_BATCH_SIZE) {
    const slice = payload.slice(index, index + UPSERT_BATCH_SIZE);
    const { error } = await client.from('sales').upsert(slice, { onConflict: 'id' });
    if (error) {
      throw error;
    }
  }
}

export async function getLastSyncInfo(): Promise<{ lastSyncedAt: string | null; total: number }> {
  const summary = await getSalesSummary();
  return {
    lastSyncedAt: summary.lastSyncedAt,
    total: summary.totalSales
  };
}
