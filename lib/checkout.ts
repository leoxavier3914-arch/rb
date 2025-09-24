const COUPON_PARAMS = ['coupon', 'cupom', 'discount_code', 'discount'];
const MANUAL_TRACKING_PARAM = 'rb_manual';
const MANUAL_TRACKING_VALUE = 'email';
const DEFAULT_ORGANIC_SOURCE = 'manual-email';
const DEFAULT_ORGANIC_MEDIUM = 'email';
const DEFAULT_MANUAL_CAMPAIGN = 'manual-reminder';
const PAID_HINTS = [
  'paid',
  'ads',
  'pago',
  'trafego',
  'tráfego',
  'midia paga',
  'midiapaga',
  'cpc',
  'cpa',
  'cpp',
  'cpm',
  'ppc',
  'display',
  'remarketing',
  'retargeting',
];

function normalize(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function applyDiscountToCheckoutUrl(
  checkoutUrl?: string | null,
  discountCode?: string | null,
): string {
  const url = normalize(checkoutUrl);
  const code = normalize(discountCode);

  if (!url) return '';
  if (!code) return url;

  try {
    const parsed = new URL(url);
    let applied = false;

    for (const param of COUPON_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, code);
        applied = true;
      }
    }

    if (!applied) {
      parsed.searchParams.set('coupon', code);
    }

    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}coupon=${encodeURIComponent(code)}`;
  }
}

function getParamCaseInsensitive(params: URLSearchParams, key: string): string | null {
  const lower = key.toLowerCase();
  for (const existingKey of params.keys()) {
    if (existingKey.toLowerCase() === lower) {
      const value = params.get(existingKey);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

function detectPaidTrafficHint(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return PAID_HINTS.some((hint) => normalized.includes(hint));
}

function detectPaidTraffic(
  medium: string | null,
  trafficSource: string | null | undefined,
): boolean {
  if (detectPaidTrafficHint(medium)) {
    return true;
  }

  if (detectPaidTrafficHint(trafficSource)) {
    return true;
  }

  return false;
}

function extractChannelFromTrafficSource(trafficSource: string | null | undefined): string | null {
  if (typeof trafficSource !== 'string') return null;
  const trimmed = trafficSource.trim().toLowerCase();
  if (!trimmed || trimmed === 'unknown') return null;
  const [first] = trimmed.split(/[./\-|>]/);
  if (!first) return null;
  return first;
}

type ManualTrackingOptions = {
  trafficSource?: string | null;
};

export function applyManualTrackingToCheckoutUrl(
  checkoutUrl?: string | null,
  options?: ManualTrackingOptions,
): string {
  const url = normalize(checkoutUrl);
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    params.set(MANUAL_TRACKING_PARAM, MANUAL_TRACKING_VALUE);

    const existingMedium = getParamCaseInsensitive(params, 'utm_medium');
    const existingSource = getParamCaseInsensitive(params, 'utm_source');
    const existingCampaign = getParamCaseInsensitive(params, 'utm_campaign');

    const isPaidTraffic = detectPaidTraffic(existingMedium, options?.trafficSource ?? null);

    if (!existingSource) {
      const inferredChannel = isPaidTraffic
        ? extractChannelFromTrafficSource(options?.trafficSource ?? null)
        : null;
      params.set('utm_source', inferredChannel ?? DEFAULT_ORGANIC_SOURCE);
    }

    if (!existingMedium) {
      params.set('utm_medium', isPaidTraffic ? 'paid' : DEFAULT_ORGANIC_MEDIUM);
    }

    if (!existingCampaign) {
      params.set('utm_campaign', DEFAULT_MANUAL_CAMPAIGN);
    }

    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${MANUAL_TRACKING_PARAM}=${encodeURIComponent(MANUAL_TRACKING_VALUE)}`;
  }
}
