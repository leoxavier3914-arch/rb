import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { buildCacheKey, getCache, setCache } from '@/lib/cache';
import { resolvePeriod } from '@/lib/hub/period';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SaleRow {
  readonly product_id: string | null;
  readonly total_amount_cents: number | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
  readonly status: string | null;
}

interface AggregatedProduct {
  readonly id: string;
  readonly title: string;
  readonly revenue_cents: number;
  readonly total_sales: number;
  readonly revenue_cents_prev?: number;
  readonly total_sales_prev?: number;
  readonly revenue_cents_delta_percent?: number;
  readonly total_sales_delta_percent?: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const metricParam = params.get('metric');
  const metric: 'revenue' | 'qty' = metricParam === 'qty' ? 'qty' : 'revenue';
  const period = resolvePeriod(params);
  const cacheKey = buildCacheKey('top_products_cache:', {
    metric,
    from: period.current.from.toISOString(),
    to: period.current.to.toISOString(),
    compare: period.compare,
    previousFrom: period.previous?.from.toISOString() ?? null,
    previousTo: period.previous?.to.toISOString() ?? null
  });

  const cached = await getCache<AggregatedProduct[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, metric, compare: period.compare, products: cached });
  }

  try {
    const client = getServiceClient();
    const currentSales = await fetchApprovedSales(client, period.current.from, period.current.to);
    const currentAggregated = aggregateByProduct(currentSales);

    let products = await enrichProducts(client, currentAggregated, metric);

    if (period.compare && period.previous) {
      const previousSales = await fetchApprovedSales(client, period.previous.from, period.previous.to);
      const previousAggregated = aggregateByProduct(previousSales);
      products = mergeProductMetrics(products, previousAggregated);
    }

    await setCache(cacheKey, products);

    return NextResponse.json({ ok: true, metric, compare: period.compare, products });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao calcular ranking de produtos.';
    return NextResponse.json({ ok: false, code: 'top_products_failed', error: message }, { status: 500 });
  }
}

async function fetchApprovedSales(
  client: ReturnType<typeof getServiceClient>,
  from: Date,
  to: Date
): Promise<SaleRow[]> {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const filter =
    `and(paid_at.not.is.null,paid_at.gte.${fromIso},paid_at.lte.${toIso}),` +
    `and(paid_at.is.null,status.in.(approved,paid),created_at.gte.${fromIso},created_at.lte.${toIso})`;
  const { data, error } = await client
    .from('kfy_sales')
    .select('product_id, total_amount_cents, status, created_at, paid_at')
    .not('product_id', 'is', null)
    .or(filter);

  if (error) {
    throw new Error(`Falha ao carregar vendas aprovadas: ${error.message ?? 'erro desconhecido'}`);
  }

  return (data ?? []) as SaleRow[];
}

function aggregateByProduct(rows: readonly SaleRow[]): Map<string, { revenue: number; qty: number }> {
  const map = new Map<string, { revenue: number; qty: number }>();
  for (const row of rows) {
    if (!row.product_id) {
      continue;
    }
    const entry = map.get(row.product_id) ?? { revenue: 0, qty: 0 };
    entry.revenue += row.total_amount_cents ?? 0;
    entry.qty += 1;
    map.set(row.product_id, entry);
  }
  return map;
}

async function enrichProducts(
  client: ReturnType<typeof getServiceClient>,
  aggregated: Map<string, { revenue: number; qty: number }>,
  metric: 'revenue' | 'qty'
): Promise<AggregatedProduct[]> {
  const ids = Array.from(aggregated.keys());
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('kfy_products')
    .select('id, title')
    .in('id', ids);

  if (error) {
    throw new Error(`Falha ao carregar produtos: ${error.message ?? 'erro desconhecido'}`);
  }

  const titles = new Map((data ?? []).map(row => [row.id, row.title ?? 'Produto sem título'] as const));

  const list = ids.map(id => {
    const entry = aggregated.get(id)!;
    return {
      id,
      title: titles.get(id) ?? 'Produto sem título',
      revenue_cents: entry.revenue,
      total_sales: entry.qty
    } satisfies AggregatedProduct;
  });

  list.sort((a, b) => {
    const left = metric === 'qty' ? a.total_sales : a.revenue_cents;
    const right = metric === 'qty' ? b.total_sales : b.revenue_cents;
    return right - left;
  });

  return list.slice(0, 10);
}

function mergeProductMetrics(
  current: AggregatedProduct[],
  previous: Map<string, { revenue: number; qty: number }>
): AggregatedProduct[] {
  return current.map(item => {
    const previousEntry = previous.get(item.id) ?? { revenue: 0, qty: 0 };
    return {
      ...item,
      revenue_cents_prev: previousEntry.revenue,
      total_sales_prev: previousEntry.qty,
      revenue_cents_delta_percent: computeDelta(item.revenue_cents, previousEntry.revenue),
      total_sales_delta_percent: computeDelta(item.total_sales, previousEntry.qty)
    };
  });
}

function computeDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}
