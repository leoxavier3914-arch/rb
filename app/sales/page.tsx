import Card from '../../components/Card';
import Table from '../../components/Table';
import SalesTable from '../../components/SalesTable';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { getTrafficCategory, type TrafficCategory } from '../../lib/traffic';
import type { Sale } from '../../lib/types';
import { parsePgTimestamp } from '../../lib/dates';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const clean = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text !== '-' && text !== '—' ? text : '';
};

async function fetchSales(): Promise<Sale[]> {
  noStore();

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('abandoned_emails')
      .select('*')
      .or('paid.eq.true,status.eq.converted')
      .order('paid_at', { ascending: false });

    if (error) {
      console.error('[kiwify-hub] erro ao consultar vendas aprovadas', error);
      return [];
    }

    const rows = (data ?? []) as Record<string, any>[];

    return rows.map((row) => {
      const payload = (row?.payload ?? {}) as Record<string, unknown>;
      const productFromPayload = clean(payload.product_name) || clean(payload.offer_name);
      const trafficFromPayload = clean(payload.traffic_source);

      return {
        id: String(row.id),
        customer_email: clean(row.customer_email) || clean(row.email) || '',
        customer_name: clean(row.customer_name) || null,
        product_name:
          clean(row.product_name) || clean(row.product_title) || productFromPayload || null,
        product_id: clean(row.product_id) || null,
        status: clean(row.status) || (row.paid ? 'converted' : null),
        paid_at: row.paid_at ?? null,
        traffic_source: clean(row.traffic_source) || trafficFromPayload || null,
      } satisfies Sale;
    });
  } catch (error) {
    console.error('[kiwify-hub] supabase indisponível ao buscar vendas aprovadas', error);
    return [];
  }
}

type SalesPeriodRow = {
  period: string;
  label: string;
  count: number;
};

type SalesMetrics = {
  total: number;
  last7DaysCount: number;
  last30DaysCount: number;
  channelCounts: Record<TrafficCategory, number>;
  uniqueSources: { label: string; count: number }[];
  dailyBreakdown: SalesPeriodRow[];
};

function computeSalesMetrics(sales: Sale[]): SalesMetrics {
  const now = Date.now();
  const msInDay = 24 * 60 * 60 * 1000;
  const channelCounts: Record<TrafficCategory, number> = {
    organic: 0,
    tiktok: 0,
    other: 0,
  };

  let last7DaysCount = 0;
  let last30DaysCount = 0;

  const sourcesMap = new Map<string, number>();
  const perDay = new Map<string, { date: Date; count: number }>();

  const isoFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const labelFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  });

  for (const sale of sales) {
    const category = getTrafficCategory(sale.traffic_source);
    channelCounts[category] += 1;

    const trafficLabel = sale.traffic_source ? sale.traffic_source : 'Outros canais';
    sourcesMap.set(trafficLabel, (sourcesMap.get(trafficLabel) ?? 0) + 1);

    const paidDate = parsePgTimestamp(sale.paid_at);
    if (!paidDate) {
      continue;
    }

    const timestamp = paidDate.getTime();
    if (timestamp >= now - 7 * msInDay) {
      last7DaysCount += 1;
    }
    if (timestamp >= now - 30 * msInDay) {
      last30DaysCount += 1;
    }

    const periodKey = isoFormatter.format(paidDate);
    const existing = perDay.get(periodKey);
    if (existing) {
      existing.count += 1;
      if (timestamp > existing.date.getTime()) {
        existing.date = paidDate;
      }
    } else {
      perDay.set(periodKey, { date: paidDate, count: 1 });
    }
  }

  const uniqueSources = Array.from(sourcesMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const dailyBreakdown = Array.from(perDay.entries())
    .map(([period, { date, count }]) => ({
      period,
      label: labelFormatter.format(date),
      count,
    }))
    .sort((a, b) => b.period.localeCompare(a.period));

  return {
    total: sales.length,
    last7DaysCount,
    last30DaysCount,
    channelCounts,
    uniqueSources,
    dailyBreakdown,
  };
}

export default async function SalesPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const sales = await fetchSales();
  const metrics = computeSalesMetrics(sales);

  const topSource = metrics.uniqueSources[0] ?? null;
  const recentPeriods = metrics.dailyBreakdown.slice(0, 7);

  const periodColumns = [
    { key: 'label' as const, header: 'Dia' },
    { key: 'count' as const, header: 'Vendas', className: 'text-right' },
  ];

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Kiwify Hub</p>
        <h1 className="text-3xl font-bold">Vendas aprovadas</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Analise as conversões confirmadas na Kiwify, identifique os principais canais de tráfego e acompanhe a
          evolução diária do faturamento aprovado.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Total de vendas"
          value={metrics.total}
          description="Registros marcados como pagos ou convertidos no Supabase."
        />
        <Card
          title="Últimos 7 dias"
          value={metrics.last7DaysCount}
          description="Pagamentos confirmados nos últimos 7 dias."
        />
        <Card
          title="Últimos 30 dias"
          value={metrics.last30DaysCount}
          description="Conversões registradas no período recente de 30 dias."
        />
        <Card
          title="Canal principal"
          value={topSource ? topSource.label : '—'}
          description={
            topSource
              ? `${topSource.count} conversão(ões) registradas neste canal.`
              : 'Nenhuma origem identificada até o momento.'
          }
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card
          title="Orgânico"
          value={metrics.channelCounts.organic}
          description="Tráfego direto, SEO e outras origens não pagas."
        />
        <Card
          title="TikTok Ads"
          value={metrics.channelCounts.tiktok}
          description="Conversões provenientes das campanhas de TikTok."
        />
        <Card
          title="Outros canais"
          value={metrics.channelCounts.other}
          description="Demais origens informadas na conversão."
        />
      </section>

      {recentPeriods.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Resumo diário recente</h2>
            <p className="text-sm text-slate-400">Últimos dias com registros confirmados.</p>
          </div>
          <Table<SalesPeriodRow>
            columns={periodColumns}
            data={recentPeriods}
            getRowKey={(row) => row.period}
            emptyMessage="Nenhuma conversão registrada recentemente."
          />
        </section>
      ) : null}

      <SalesTable sales={sales} />
    </main>
  );
}
