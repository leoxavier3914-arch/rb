import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { buildCacheKey, getCache, setCache } from '@/lib/cache';
import { resolvePeriod } from '@/lib/hub/period';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SaleRow {
  readonly customer_id: string | null;
  readonly total_amount_cents: number | null;
  readonly status: string | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
}

interface CustomerRow {
  readonly id: string;
  readonly state: string | null;
  readonly country: string | null;
}

interface GeoBucket {
  readonly key: string;
  readonly qty: number;
  readonly revenue_cents: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const dateFrom = params.get('date_from');
  const dateTo = params.get('date_to');
  const period = resolvePeriod(params);
  const cacheKey = buildCacheKey('geo_cache:', {
    from: period.current.from.toISOString(),
    to: period.current.to.toISOString(),
    dateFrom: dateFrom ?? null,
    dateTo: dateTo ?? null
  });

  const cached = await getCache<{ by_state: GeoBucket[]; by_country: GeoBucket[] }>(cacheKey);
  if (cached) {
    return NextResponse.json({ ok: true, ...cached });
  }

  try {
    const client = getServiceClient();
    const sales = await fetchApprovedSales(client, period.current.from, period.current.to);
    const customers = await loadCustomers(client, sales);
    const grouped = aggregateGeo(sales, customers);

    await setCache(cacheKey, grouped);
    return NextResponse.json({ ok: true, ...grouped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao calcular distribuição geográfica.';
    return NextResponse.json({ ok: false, code: 'geo_failed', error: message }, { status: 500 });
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
    .select('customer_id, total_amount_cents, status, created_at, paid_at')
    .not('customer_id', 'is', null)
    .or(filter);

  if (error) {
    throw new Error(`Falha ao carregar vendas aprovadas: ${error.message ?? 'erro desconhecido'}`);
  }

  return (data ?? []) as SaleRow[];
}

async function loadCustomers(
  client: ReturnType<typeof getServiceClient>,
  sales: readonly SaleRow[]
): Promise<Map<string, CustomerRow>> {
  const ids = Array.from(new Set(sales.map(sale => sale.customer_id).filter((id): id is string => Boolean(id))));
  if (ids.length === 0) {
    return new Map();
  }
  const { data, error } = await client
    .from('kfy_customers')
    .select('id, state, country')
    .in('id', ids);

  if (error) {
    throw new Error(`Falha ao carregar clientes: ${error.message ?? 'erro desconhecido'}`);
  }

  return new Map((data ?? []).map(row => [row.id, row] as const));
}

function aggregateGeo(sales: readonly SaleRow[], customers: Map<string, CustomerRow>) {
  const byState = new Map<string, { qty: number; revenue: number }>();
  const byCountry = new Map<string, { qty: number; revenue: number }>();

  for (const sale of sales) {
    if (!sale.customer_id) {
      continue;
    }
    const customer = customers.get(sale.customer_id);
    const state = normalizeKey(customer?.state ?? 'Desconhecido');
    const country = normalizeKey(customer?.country ?? 'Desconhecido');
    const revenue = sale.total_amount_cents ?? 0;

    const stateEntry = byState.get(state) ?? { qty: 0, revenue: 0 };
    stateEntry.qty += 1;
    stateEntry.revenue += revenue;
    byState.set(state, stateEntry);

    const countryEntry = byCountry.get(country) ?? { qty: 0, revenue: 0 };
    countryEntry.qty += 1;
    countryEntry.revenue += revenue;
    byCountry.set(country, countryEntry);
  }

  return {
    by_state: mapBuckets(byState),
    by_country: mapBuckets(byCountry)
  };
}

function mapBuckets(source: Map<string, { qty: number; revenue: number }>): GeoBucket[] {
  const entries = Array.from(source.entries()).map(([key, value]) => ({
    key,
    qty: value.qty,
    revenue_cents: value.revenue
  }));
  entries.sort((a, b) => b.revenue_cents - a.revenue_cents);
  return entries;
}

function normalizeKey(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'Desconhecido';
}
