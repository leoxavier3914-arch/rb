import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { buildCacheKey, getCache, setCache } from '@/lib/cache';
import { resolvePeriod } from '@/lib/hub/period';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface SaleRow {
  readonly id: string;
  readonly status: string | null;
  readonly total_amount_cents: number | null;
  readonly net_amount_cents: number | null;
  readonly created_at: string | null;
  readonly paid_at: string | null;
}

interface MetricValue {
  readonly id: string;
  readonly label: string;
  readonly format: 'currency' | 'number';
  readonly current: number;
  readonly previous: number;
}

interface SeriesPoint {
  date: string;
  gross_cents: number;
  net_est_cents: number;
  approved_count: number;
  total_count: number;
}

interface CachedStats {
  readonly metrics: readonly MetricValue[];
  readonly series: {
    readonly current: readonly SeriesPoint[];
    readonly previous: readonly SeriesPoint[];
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const period = resolvePeriod(params);
  const cacheKey = buildCacheKey('stats_cache:', {
    from: period.current.from.toISOString(),
    to: period.current.to.toISOString(),
    compare: period.compare,
    previousFrom: period.previous?.from.toISOString() ?? null,
    previousTo: period.previous?.to.toISOString() ?? null
  });

  const cached = await getCache<CachedStats | MetricValue[]>(cacheKey);
  if (cached && !Array.isArray(cached) && Array.isArray(cached.metrics) && cached.series) {
    return NextResponse.json({
      ok: true,
      compare: period.compare,
      period: {
        from: period.current.from.toISOString(),
        to: period.current.to.toISOString()
      },
      metrics: cached.metrics,
      series: cached.series
    });
  }

  try {
    const client = getServiceClient();
    const currentSales = await fetchSales(client, period.current.from, period.current.to);
    const currentMetrics = computeMetrics(currentSales);
    const currentSeries = computeSeries(currentSales, period.current.from, period.current.to);
    let metrics: MetricValue[] = currentMetrics;
    let previousSeries: SeriesPoint[] = [];

    if (period.compare && period.previous) {
      const previousSales = await fetchSales(client, period.previous.from, period.previous.to);
      const previousMetrics = computeMetrics(previousSales);
      metrics = mergeMetrics(currentMetrics, previousMetrics);
      previousSeries = computeSeries(previousSales, period.previous.from, period.previous.to);
    } else {
      metrics = currentMetrics.map(metric => ({ ...metric, previous: metric.current }));
    }

    const payload: CachedStats = {
      metrics,
      series: {
        current: currentSeries,
        previous: previousSeries
      }
    };

    await setCache(cacheKey, payload);

    return NextResponse.json({
      ok: true,
      compare: period.compare,
      period: {
        from: period.current.from.toISOString(),
        to: period.current.to.toISOString()
      },
      metrics,
      series: payload.series
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao calcular estatísticas.';
    return NextResponse.json({ ok: false, code: 'stats_failed', error: message }, { status: 500 });
  }
}

async function fetchSales(client: ReturnType<typeof getServiceClient>, from: Date, to: Date): Promise<SaleRow[]> {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const filter = `and(paid_at.gte.${fromIso},paid_at.lte.${toIso}),and(paid_at.is.null,created_at.gte.${fromIso},created_at.lte.${toIso})`;
  const { data, error } = await client
    .from('kfy_sales')
    .select('id, status, total_amount_cents, net_amount_cents, created_at, paid_at')
    .or(filter);

  if (error) {
    throw new Error(`Falha ao carregar vendas: ${error.message ?? 'erro desconhecido'}`);
  }

  return (data ?? []) as SaleRow[];
}

function computeMetrics(rows: readonly SaleRow[]): MetricValue[] {
  let gross = 0;
  let net = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let refundedCount = 0;
  let rejectedCount = 0;
  const totalCount = rows.length;

  for (const row of rows) {
    const status = normalizeStatus(row.status);
    const paid = Boolean(row.paid_at);

    if (status === 'refunded') {
      refundedCount += 1;
      continue;
    }

    if (status === 'rejected' || status === 'canceled') {
      rejectedCount += 1;
      continue;
    }

    if (paid || status === 'approved' || status === 'paid') {
      approvedCount += 1;
      gross += row.total_amount_cents ?? 0;
      net += row.net_amount_cents ?? 0;
      continue;
    }

    pendingCount += 1;
  }

  const ticketMedio = approvedCount > 0 ? Math.round(gross / approvedCount) : 0;
  const approvalRate = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;

  return [
    createMetric('gross_cents', 'Receita bruta', 'currency', gross),
    createMetric('net_est_cents', 'Receita líquida estimada', 'currency', net),
    createMetric('approved_count', 'Vendas aprovadas', 'number', approvedCount),
    createMetric('pending_count', 'Vendas pendentes', 'number', pendingCount),
    createMetric('refunded_count', 'Vendas reembolsadas', 'number', refundedCount),
    createMetric('rejected_count', 'Vendas rejeitadas', 'number', rejectedCount),
    createMetric('total_count', 'Total de vendas', 'number', totalCount),
    createMetric('ticket_medio_cents', 'Ticket médio', 'currency', ticketMedio),
    createMetric('taxa_aprovacao', 'Taxa de aprovação (%)', 'number', Number(approvalRate.toFixed(2)))
  ];
}

function mergeMetrics(current: MetricValue[], previous: MetricValue[]): MetricValue[] {
  const previousMap = new Map(previous.map(metric => [metric.id, metric] as const));
  return current.map(metric => {
    const oldMetric = previousMap.get(metric.id);
    return {
      ...metric,
      previous: oldMetric ? oldMetric.current : 0
    };
  });
}

function createMetric(id: string, label: string, format: 'currency' | 'number', current: number): MetricValue {
  return { id, label, format, current, previous: current };
}

function normalizeStatus(status: string | null): string | null {
  return status ? status.toLowerCase() : null;
}

function computeSeries(rows: readonly SaleRow[], from: Date, to: Date): SeriesPoint[] {
  const buckets = createBuckets(from, to);

  for (const row of rows) {
    const dateKey = resolveDateKey(row);
    if (!dateKey) {
      continue;
    }

    const bucket = buckets.get(dateKey);
    if (!bucket) {
      continue;
    }

    bucket.total_count += 1;

    const status = normalizeStatus(row.status);
    const paid = Boolean(row.paid_at);

    if (status === 'refunded' || status === 'rejected' || status === 'canceled') {
      continue;
    }

    if (paid || status === 'approved' || status === 'paid') {
      bucket.gross_cents += row.total_amount_cents ?? 0;
      bucket.net_est_cents += row.net_amount_cents ?? 0;
      bucket.approved_count += 1;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function resolveDateKey(row: SaleRow): string | null {
  const source = row.paid_at ?? row.created_at;
  if (!source) {
    return null;
  }

  return toBucketKey(source);
}

function createBuckets(from: Date, to: Date): Map<string, SeriesPoint> {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const start = startOfDay(from);
  const end = startOfDay(to);
  const buckets = new Map<string, SeriesPoint>();

  for (let current = start.getTime(); current <= end.getTime(); current += DAY_MS) {
    const iso = new Date(current).toISOString();
    buckets.set(toBucketKey(iso), {
      date: iso,
      gross_cents: 0,
      net_est_cents: 0,
      approved_count: 0,
      total_count: 0
    });
  }

  return buckets;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function toBucketKey(value: string): string {
  const parsed = new Date(value);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed.toISOString();
}
