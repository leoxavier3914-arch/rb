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
  statuses: readonly string[] = ['paid']
): Promise<SalesPage> {
  const client = getServiceClient();
  const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const limit = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;
  const from = (currentPage - 1) * limit;
  const to = from + limit - 1;
  const appliedStatuses = statuses.length > 0 ? statuses : ['paid'];

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

function applyGroupBy<T>(builder: T, columns: string): T {
  const target = builder as unknown as { url: URL };
  target.url.searchParams.append('group', columns);
  return builder;
}

export async function listDailySales(): Promise<DailySalesRow[]> {
  const client = getServiceClient();
  type DailySalesQueryRow = {
    readonly sale_date: string | null;
    readonly total_sales: number | null;
    readonly gross_amount_cents: number | null;
    readonly net_amount_cents: number | null;
  };

  const { data, error } = await applyGroupBy(
    client
      .from('sales')
      .select(
        `
          sale_date:created_at::date,
          total_sales:count(id),
          gross_amount_cents:sum(total_amount_cents),
          net_amount_cents:sum(net_amount_cents)
        `
      )
      .order('sale_date', { ascending: true, nullsFirst: false }),
    'sale_date'
  ).returns<DailySalesQueryRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter(row => typeof row.sale_date === 'string' && row.sale_date.length > 0)
    .map(row => ({
      saleDate: row.sale_date as string,
      totalSales: Number(row.total_sales ?? 0),
      grossAmountCents: Number(row.gross_amount_cents ?? 0),
      netAmountCents: Number(row.net_amount_cents ?? 0)
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
