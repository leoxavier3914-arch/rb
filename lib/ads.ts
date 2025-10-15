import { parsePgTimestamp } from './dates';

type UnknownRecord = Record<string, unknown>;

const IGNORED_TEXT_VALUES = new Set([
  '',
  '-',
  '—',
  'unknown',
  'desconhecido',
  'desconhecida',
  'sem origem',
  'sem origem definida',
  'nao informado',
  'não informado',
  'não informado',
]);

function cleanText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const text = value.trim();
  if (!text) {
    return '';
  }

  const normalized = text.normalize('NFC').toLowerCase();
  return IGNORED_TEXT_VALUES.has(normalized) ? '' : text;
}

function getValueByPath(source: UnknownRecord | undefined | null, path: string): unknown {
  if (!source) {
    return undefined;
  }

  const segments = path.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isInteger(index) && index >= 0 && index < current.length) {
        current = current[index];
      } else {
        return undefined;
      }
    } else if (typeof current === 'object') {
      const record = current as UnknownRecord;
      const lowerSegment = segment.toLowerCase();
      const matchingKey = Object.keys(record).find((key) => key.toLowerCase() === lowerSegment);
      if (!matchingKey) {
        return undefined;
      }
      current = record[matchingKey];
    } else {
      return undefined;
    }
  }

  return current;
}

function pickString(source: UnknownRecord, paths: string[]): string | null {
  for (const path of paths) {
    const value = getValueByPath(source, path);
    const text = cleanText(value);
    if (text) {
      return text;
    }
  }

  return null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'object' && value !== null) {
    if ('count' in value) {
      return coerceNumber((value as UnknownRecord).count);
    }

    if ('value' in value) {
      return coerceNumber((value as UnknownRecord).value);
    }

    if ('total' in value) {
      return coerceNumber((value as UnknownRecord).total);
    }
  }

  return null;
}

function pickNumber(source: UnknownRecord, paths: string[]): number | null {
  for (const path of paths) {
    const value = getValueByPath(source, path);
    const number = coerceNumber(value);
    if (number !== null) {
      return number;
    }
  }

  return null;
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'bigint') {
    return value !== BigInt(0);
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    const TRUE_TOKENS = new Set(['true', 't', '1', 'yes', 'y', 'sim', 's']);
    const FALSE_TOKENS = new Set(['false', 'f', '0', 'no', 'n', 'nao', 'não', 'não']);

    if (TRUE_TOKENS.has(normalized)) {
      return true;
    }

    if (FALSE_TOKENS.has(normalized)) {
      return false;
    }
  }

  return false;
}

export type AdMetricValue = {
  value: number;
  estimated: boolean;
};

export type AdPerformance = {
  key: string;
  displayName: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  adGroup: string | null;
  adName: string | null;
  campaignId: string | null;
  adId: string | null;
  pixelId: string | null;
  trafficSource: string | null;
  adClicks: AdMetricValue;
  ctaClicks: AdMetricValue;
  totalCheckouts: number;
  abandonedCarts: number;
  paymentsApproved: number;
  conversionRate: number | null;
  lastInteractionAt: string | null;
};

type AdAccumulator = {
  key: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  adGroup: string | null;
  adName: string | null;
  campaignId: string | null;
  adId: string | null;
  pixelId: string | null;
  trafficSource: string | null;
  adClicks: number | null;
  hasAdClicksMetric: boolean;
  ctaClicks: number | null;
  hasCtaClicksMetric: boolean;
  totalCheckouts: number;
  abandonedCarts: number;
  paymentsApproved: number;
  lastInteractionAt: string | null;
  lastInteractionTimestamp: number;
};

export type RawAdEvent = {
  id: string;
  paid: unknown;
  status?: string | null;
  traffic_source?: string | null;
  payload?: UnknownRecord | null;
  created_at?: string | null;
  updated_at?: string | null;
  paid_at?: string | null;
};

const AD_CLICK_PATHS = [
  'ad_clicks',
  'adClicks',
  'clicks',
  'pixel.clicks',
  'pixel_clicks',
  'tt_pixel.clicks',
  'analytics.clicks',
  'analytics.ad_clicks',
  'metrics.clicks',
  'metrics.ad_clicks',
  'insights.clicks',
];

const CTA_CLICK_PATHS = [
  'cta_clicks',
  'ctaClicks',
  'button_clicks',
  'buttonClicks',
  'call_to_action_clicks',
  'callToAction.clicks',
  'analytics.cta_clicks',
  'analytics.button_clicks',
  'pixel.cta_clicks',
  'metrics.cta_clicks',
];

const UTM_SOURCE_PATHS = [
  'utm_source',
  'utmSource',
  'trackingparameters.utm_source',
  'traffic_source',
  'trafficSource',
  'source_platform',
  'marketing_source',
];

const UTM_MEDIUM_PATHS = [
  'utm_medium',
  'utmMedium',
  'trackingparameters.utm_medium',
  'traffic_medium',
  'campaign_medium',
  'marketing_medium',
];

const UTM_CAMPAIGN_PATHS = [
  'utm_campaign',
  'utmCampaign',
  'trackingparameters.utm_campaign',
  'campaign',
  'campaign_name',
  'campaignName',
  'campaign_title',
  'campaignTitle',
];

const ADGROUP_PATHS = [
  'adgroup',
  'adgroup_name',
  'adgroupName',
  'adset',
  'adset_name',
  'adsetName',
];

const AD_NAME_PATHS = [
  'ad_name',
  'adName',
  'creative_name',
  'creativeName',
  'ad_title',
  'adTitle',
];

const CAMPAIGN_ID_PATHS = ['campaign_id', 'campaignId'];
const AD_ID_PATHS = ['ad_id', 'adId'];

const PIXEL_ID_PATHS = [
  'pixel_id',
  'pixelId',
  'pixel.id',
  'tt_pixel_id',
  'ttPixelId',
  'tiktok_pixel_id',
  'tiktokPixelId',
];

function chooseValue(existing: string | null, next: string | null): string | null {
  if (next && !existing) {
    return next;
  }

  if (!next) {
    return existing;
  }

  if (!existing) {
    return next;
  }

  if (existing.toLowerCase() === 'unknown' && next.toLowerCase() !== 'unknown') {
    return next;
  }

  if (next.length > existing.length) {
    return next;
  }

  return existing;
}

function updateTimestamp(
  previousTimestamp: number,
  previousValue: string | null,
  candidate: string | null,
): { timestamp: number; value: string | null } {
  if (!candidate) {
    return { timestamp: previousTimestamp, value: previousValue };
  }

  const parsed = parsePgTimestamp(candidate);
  if (!parsed) {
    return { timestamp: previousTimestamp, value: previousValue };
  }

  const time = parsed.getTime();
  if (time > previousTimestamp) {
    return { timestamp: time, value: candidate };
  }

  return { timestamp: previousTimestamp, value: previousValue };
}

function buildKey(parts: Array<string | null>): string {
  return parts
    .map((part) => (part ? part.trim().toLowerCase() : ''))
    .map((part) => (part ? part.replace(/\s+/g, '-') : 'unknown'))
    .join('__');
}

export function computeAdPerformance(rows: RawAdEvent[]): AdPerformance[] {
  const map = new Map<string, AdAccumulator>();

  for (const row of rows) {
    const payload = (row.payload ?? {}) as UnknownRecord;

    const utmSource = pickString(payload, UTM_SOURCE_PATHS) || cleanText(row.traffic_source) || null;
    const utmMedium = pickString(payload, UTM_MEDIUM_PATHS);
    const utmCampaign = pickString(payload, UTM_CAMPAIGN_PATHS);
    const adGroup = pickString(payload, ADGROUP_PATHS);
    const adName = pickString(payload, AD_NAME_PATHS);
    const campaignId = pickString(payload, CAMPAIGN_ID_PATHS);
    const adId = pickString(payload, AD_ID_PATHS);
    const pixelId = pickString(payload, PIXEL_ID_PATHS);

    const key = buildKey([utmSource, utmMedium, utmCampaign, adGroup, adName]);
    const existing = map.get(key);

    const { timestamp, value } = updateTimestamp(
      existing?.lastInteractionTimestamp ?? Number.NEGATIVE_INFINITY,
      existing?.lastInteractionAt ?? null,
      row.paid_at ?? row.updated_at ?? row.created_at ?? null,
    );

    const adClicksMetric = pickNumber(payload, AD_CLICK_PATHS);
    const ctaClicksMetric = pickNumber(payload, CTA_CLICK_PATHS);

    const paid = coerceBoolean(row.paid);
    const status = cleanText(row.status);
    const isApproved =
      paid || status === 'approved' || status === 'pagamento aprovado' || status === 'converted';

    const accumulator: AdAccumulator = existing ?? {
      key,
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
      adGroup: adGroup ?? null,
      adName: adName ?? null,
      campaignId: campaignId ?? null,
      adId: adId ?? null,
      pixelId: pixelId ?? null,
      trafficSource: cleanText(row.traffic_source) || null,
      adClicks: null,
      hasAdClicksMetric: false,
      ctaClicks: null,
      hasCtaClicksMetric: false,
      totalCheckouts: 0,
      abandonedCarts: 0,
      paymentsApproved: 0,
      lastInteractionAt: value,
      lastInteractionTimestamp: timestamp,
    };

    accumulator.utmSource = chooseValue(accumulator.utmSource, utmSource);
    accumulator.utmMedium = chooseValue(accumulator.utmMedium, utmMedium);
    accumulator.utmCampaign = chooseValue(accumulator.utmCampaign, utmCampaign);
    accumulator.adGroup = chooseValue(accumulator.adGroup, adGroup);
    accumulator.adName = chooseValue(accumulator.adName, adName);
    accumulator.campaignId = chooseValue(accumulator.campaignId, campaignId);
    accumulator.adId = chooseValue(accumulator.adId, adId);
    accumulator.pixelId = chooseValue(accumulator.pixelId, pixelId);
    accumulator.trafficSource = chooseValue(accumulator.trafficSource, cleanText(row.traffic_source));

    if (adClicksMetric !== null) {
      accumulator.adClicks = Math.max(accumulator.adClicks ?? 0, adClicksMetric);
      accumulator.hasAdClicksMetric = true;
    }

    if (ctaClicksMetric !== null) {
      accumulator.ctaClicks = Math.max(accumulator.ctaClicks ?? 0, ctaClicksMetric);
      accumulator.hasCtaClicksMetric = true;
    }

    accumulator.totalCheckouts += 1;
    if (!isApproved) {
      accumulator.abandonedCarts += 1;
    }
    if (isApproved) {
      accumulator.paymentsApproved += 1;
    }

    accumulator.lastInteractionTimestamp = timestamp;
    accumulator.lastInteractionAt = value;

    map.set(key, accumulator);
  }

  const performances: AdPerformance[] = [];

  map.forEach((accumulator) => {
    const resolvedAdClicks: AdMetricValue = accumulator.hasAdClicksMetric
      ? { value: Math.max(0, Math.round(accumulator.adClicks ?? 0)), estimated: false }
      : { value: accumulator.totalCheckouts, estimated: true };

    const resolvedCtaClicks: AdMetricValue = accumulator.hasCtaClicksMetric
      ? { value: Math.max(0, Math.round(accumulator.ctaClicks ?? 0)), estimated: false }
      : { value: accumulator.totalCheckouts, estimated: true };

    const conversionRatio = resolvedCtaClicks.value > 0
      ? accumulator.paymentsApproved / resolvedCtaClicks.value
      : accumulator.totalCheckouts > 0
        ? accumulator.paymentsApproved / accumulator.totalCheckouts
        : null;

    const conversionRate =
      conversionRatio === null || Number.isNaN(conversionRatio)
        ? null
        : Math.max(0, Math.min(1, conversionRatio));

    const displayName =
      accumulator.utmCampaign ??
      accumulator.adName ??
      accumulator.adGroup ??
      accumulator.utmSource ??
      'Campanha sem nome';

    performances.push({
      key: accumulator.key,
      displayName,
      utmSource: accumulator.utmSource,
      utmMedium: accumulator.utmMedium,
      utmCampaign: accumulator.utmCampaign,
      adGroup: accumulator.adGroup,
      adName: accumulator.adName,
      campaignId: accumulator.campaignId,
      adId: accumulator.adId,
      pixelId: accumulator.pixelId,
      trafficSource: accumulator.trafficSource,
      adClicks: resolvedAdClicks,
      ctaClicks: resolvedCtaClicks,
      totalCheckouts: accumulator.totalCheckouts,
      abandonedCarts: accumulator.abandonedCarts,
      paymentsApproved: accumulator.paymentsApproved,
      conversionRate,
      lastInteractionAt: accumulator.lastInteractionAt,
    });
  });

  performances.sort((a, b) => {
    if (b.paymentsApproved !== a.paymentsApproved) {
      return b.paymentsApproved - a.paymentsApproved;
    }

    if (b.adClicks.value !== a.adClicks.value) {
      return b.adClicks.value - a.adClicks.value;
    }

    return (b.lastInteractionAt ? parsePgTimestamp(b.lastInteractionAt)?.getTime() ?? 0 : 0) -
      (a.lastInteractionAt ? parsePgTimestamp(a.lastInteractionAt)?.getTime() ?? 0 : 0);
  });

  return performances;
}
