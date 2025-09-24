import type { ReactNode } from 'react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import AdsTable from '../../components/AdsTable';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';
import { computeAdPerformance, type AdPerformance, type RawAdEvent, type AdMetricValue } from '../../lib/ads';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';

export const dynamic = 'force-dynamic';

const numberFormatter = new Intl.NumberFormat('pt-BR');

type AggregatedMetric = {
  value: number;
  estimated: boolean;
};

async function fetchAdsPerformance(): Promise<AdPerformance[]> {
  noStore();
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('abandoned_emails')
      .select('id, paid, status, traffic_source, payload, created_at, updated_at, paid_at');

    if (error) {
      console.error('[ads] erro ao consultar eventos', error);
      return [];
    }

    const rows = (data ?? []) as RawAdEvent[];
    return computeAdPerformance(rows);
  } catch (error) {
    console.error('[ads] supabase indisponível', error);
    return [];
  }
}

function aggregateMetric(metrics: AdMetricValue[]): AggregatedMetric {
  return metrics.reduce(
    (acc, metric) => ({
      value: acc.value + metric.value,
      estimated: acc.estimated || metric.estimated,
    }),
    { value: 0, estimated: false },
  );
}

function resolveCardDescription(metric: AggregatedMetric, preciseHint: string, estimatedHint: string): string {
  return metric.estimated ? estimatedHint : preciseHint;
}

export default async function AdsPage() {
  noStore();

  const adminToken = process.env.ADMIN_TOKEN;
  const token = cookies().get('admin_token');
  if (!adminToken || !token || token.value !== adminToken) {
    redirect('/login');
  }

  const ads = await fetchAdsPerformance();
  const paidCampaignAds = ads.filter((item) => {
    const medium = item.utmMedium?.trim().toLowerCase();
    const campaign = item.utmCampaign?.trim();

    return Boolean(campaign) && medium === 'paid';
  });
  const tiktokAds = paidCampaignAds.filter(
    (item) => item.utmCampaign?.trim().toLowerCase() === 'adstiktok',
  );

  const adClicks = aggregateMetric(paidCampaignAds.map((item) => item.adClicks));
  const ctaClicks = aggregateMetric(paidCampaignAds.map((item) => item.ctaClicks));
  const abandonedCarts = tiktokAds.reduce((sum, item) => sum + item.abandonedCarts, 0);
  const paymentsApproved = paidCampaignAds.reduce((sum, item) => sum + item.paymentsApproved, 0);

  return (
    <main className="flex flex-1 flex-col gap-10 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Gestão de Ads</p>
        <h1 className="text-3xl font-bold">Performance dos anúncios</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Acompanhe os cliques, abandono de carrinhos e as conversões dos anúncios monitorados via pixel e parâmetros UTM.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Cliques no anúncio"
          value={metricValueToNode(adClicks)}
          description={resolveCardDescription(
            adClicks,
            'Total de cliques reportados pelo pixel ou pelo gestor de tráfego.',
            'Estimativa calculada a partir dos checkouts recebidos.',
          )}
        />
        <Card
          title="Cliques na chamada de ação"
          value={metricValueToNode(ctaClicks)}
          description={resolveCardDescription(
            ctaClicks,
            'Total de cliques no botão capturados pelo pixel ou evento associado.',
            'Estimativa baseada nos checkouts processados.',
          )}
        />
        <Card
          title="Carrinhos abandonados"
          value={numberFormatter.format(abandonedCarts)}
          description="Quantidade de checkouts iniciados que ainda não converteram."
        />
        <Card
          title="Pagamentos aprovados"
          value={numberFormatter.format(paymentsApproved)}
          description="Conversões registradas para os anúncios monitorados."
        />
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">Detalhes por anúncio</h2>
          <p className="text-sm text-slate-400">
            Use os parâmetros de UTM para entender a performance de cada campanha ativa, inclusive o anúncio do TikTok Ads com pixel e mídias pagas.
          </p>
        </div>

        <AdsTable ads={paidCampaignAds} />
      </section>
    </main>
  );
}

function metricValueToNode(metric: AggregatedMetric): ReactNode {
  const displayValue = metric.estimated
    ? `~${numberFormatter.format(metric.value)}`
    : numberFormatter.format(metric.value);

  return (
    <span className="flex items-center gap-2">
      <span>{displayValue}</span>
      {metric.estimated ? <Badge variant="pending">Estimado</Badge> : null}
    </span>
  );
}
