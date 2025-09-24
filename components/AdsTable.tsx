'use client';

import { useMemo } from 'react';
import Table from './Table';
import Badge from './Badge';
import { formatSaoPaulo } from '../lib/dates';
import { formatTrafficSourceLabel } from '../lib/traffic';
import { type AdPerformance, type AdMetricValue } from '../lib/ads';
import type { ReactNode } from 'react';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

function formatMetric(metric: AdMetricValue): ReactNode {
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

function formatConversionRate(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }

  return percentFormatter.format(value);
}

type AdsTableProps = {
  ads: AdPerformance[];
};

export default function AdsTable({ ads }: AdsTableProps) {
  const columns = useMemo(
    () => [
      {
        key: 'displayName' as const,
        header: 'Campanha',
        render: (ad: AdPerformance) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-white">{ad.displayName}</span>
            <span className="text-xs text-slate-400">
              {ad.utmSource ? ad.utmSource : 'Fonte desconhecida'} ·{' '}
              {ad.utmMedium ? ad.utmMedium : 'Mídia indefinida'}
            </span>
          </div>
        ),
      },
      {
        key: 'trafficSource' as const,
        header: 'Canal',
        render: (ad: AdPerformance) => formatTrafficSourceLabel(ad.trafficSource),
      },
      {
        key: 'adClicks' as const,
        header: 'Cliques (anúncio)',
        render: (ad: AdPerformance) => formatMetric(ad.adClicks),
      },
      {
        key: 'ctaClicks' as const,
        header: 'Cliques (CTA)',
        render: (ad: AdPerformance) => formatMetric(ad.ctaClicks),
      },
      {
        key: 'abandonedCarts' as const,
        header: 'Carrinhos abandonados',
        render: (ad: AdPerformance) => numberFormatter.format(ad.abandonedCarts),
      },
      {
        key: 'paymentsApproved' as const,
        header: 'Pagamentos aprovados',
        render: (ad: AdPerformance) => numberFormatter.format(ad.paymentsApproved),
      },
      {
        key: 'conversionRate' as const,
        header: 'Taxa de conversão',
        render: (ad: AdPerformance) => formatConversionRate(ad.conversionRate),
      },
      {
        key: 'lastInteractionAt' as const,
        header: 'Última atividade',
        render: (ad: AdPerformance) => formatSaoPaulo(ad.lastInteractionAt ?? null),
      },
    ],
    [],
  );

  return (
    <Table<AdPerformance>
      columns={columns}
      data={ads}
      getRowKey={(ad) => ad.key}
      emptyMessage="Nenhum anúncio com UTM encontrado até o momento."
    />
  );
}
