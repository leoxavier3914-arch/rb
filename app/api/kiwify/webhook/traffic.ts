import { pickByKeys } from './utils';

function parseCheckoutSearchParams(url: string | null | undefined): URLSearchParams | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams;
  } catch {
    try {
      return new URL(url, 'https://example.com').searchParams;
    } catch {
      return null;
    }
  }
}

const UTM_PARAM_PATHS: Record<string, string[]> = {
  utm_source: ['utm_source', 'utmSource', 'trackingparameters.utm_source'],
  utm_medium: ['utm_medium', 'utmMedium', 'trackingparameters.utm_medium'],
  utm_campaign: ['utm_campaign', 'utmCampaign', 'trackingparameters.utm_campaign'],
  utm_content: ['utm_content', 'utmContent', 'trackingparameters.utm_content'],
  utm_term: ['utm_term', 'utmTerm', 'trackingparameters.utm_term'],
  utm_id: ['utm_id', 'utmId', 'trackingparameters.utm_id'],
  utm_source_platform: [
    'utm_source_platform',
    'utmSourcePlatform',
    'trackingparameters.utm_source_platform',
  ],
  utm_platform: ['utm_platform', 'utmPlatform', 'trackingparameters.utm_platform'],
  utm_channel: ['utm_channel', 'utmChannel', 'trackingparameters.utm_channel'],
};

export type TrackingParamMap = Record<string, string>;

function cleanTrackingValue(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function extractTrackingParams(body: any): TrackingParamMap {
  const params: TrackingParamMap = {};

  for (const [target, paths] of Object.entries(UTM_PARAM_PATHS)) {
    const value = pickByKeys(body, paths, (v) => typeof v === 'string' && v.trim().length > 0);
    const cleaned = cleanTrackingValue(value);
    if (cleaned) {
      params[target] = cleaned;
    }
  }

  return params;
}

function hasTrackingParams(params: TrackingParamMap): boolean {
  return Object.keys(params).length > 0;
}

export function hasUrlTrackingParams(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    let found = false;
    parsed.searchParams.forEach((_, key) => {
      if (!found && key.toLowerCase().startsWith('utm_')) {
        found = true;
      }
    });
    if (found) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function sameUrlBase(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    const urlA = new URL(a);
    const urlB = new URL(b);
    return urlA.origin === urlB.origin && urlA.pathname === urlB.pathname;
  } catch {
    return false;
  }
}

function hasParamCaseInsensitive(params: URLSearchParams, key: string): boolean {
  const lower = key.toLowerCase();
  let match = false;
  params.forEach((_, existingKey) => {
    if (!match && existingKey.toLowerCase() === lower) {
      match = true;
    }
  });
  return match;
}

export function mergeCheckoutUrlWithTracking(
  baseUrl: string | null,
  params: TrackingParamMap,
  fallbackUrl: string | null,
): string | null {
  if (!baseUrl) {
    return fallbackUrl;
  }

  if (!hasTrackingParams(params)) {
    if (
      fallbackUrl &&
      fallbackUrl !== baseUrl &&
      hasUrlTrackingParams(fallbackUrl) &&
      !hasUrlTrackingParams(baseUrl) &&
      sameUrlBase(fallbackUrl, baseUrl)
    ) {
      return fallbackUrl;
    }
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    let changed = false;

    for (const [key, value] of Object.entries(params)) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (hasParamCaseInsensitive(parsed.searchParams, key)) continue;
      parsed.searchParams.set(key, trimmed);
      changed = true;
    }

    return changed ? parsed.toString() : baseUrl;
  } catch {
    return baseUrl;
  }
}

const MANUAL_TRACKING_PARAM_KEYS = ['rb_manual'];

function detectManualReminder(params: URLSearchParams | null): string | null {
  if (!params) return null;

  for (const key of Array.from(params.keys())) {
    const normalizedKey = key.trim().toLowerCase();
    if (MANUAL_TRACKING_PARAM_KEYS.includes(normalizedKey)) {
      const value = params.get(key);
      if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (trimmed) {
          return trimmed;
        }
      }
    }
  }

  return null;
}

function normalizeTrafficString(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type TrafficContext = {
  tokens: Set<string>;
  combined: string[];
  paramKeys: Set<string>;
  paramTokens: Set<string>;
};

type ChannelHintGroup = {
  channel: string;
  hints: string[];
  strictTokens?: string[];
};

const CHANNEL_HINT_GROUPS: ChannelHintGroup[] = [
  {
    channel: 'tiktok',
    hints: [
      'tiktok',
      'ttclid',
      'ttad',
      'ttads',
      'ttadgroup',
      'ttcampaign',
      'tiktokads',
      'tt pixel',
      'bt pixel',
    ],
    strictTokens: ['tiktok'],
  },
  {
    channel: 'instagram',
    hints: ['instagram', 'insta', 'ig'],
  },
  {
    channel: 'facebook',
    hints: ['facebook', 'meta', 'fb', 'fbads', 'fbclid'],
  },
  {
    channel: 'google',
    hints: ['google', 'gclid', 'adwords', 'googleads'],
  },
  {
    channel: 'bing',
    hints: ['bing', 'msclkid', 'microsoft'],
  },
  {
    channel: 'taboola',
    hints: ['taboola'],
  },
  {
    channel: 'kwai',
    hints: ['kwai'],
  },
  {
    channel: 'pinterest',
    hints: ['pinterest', 'pin'],
  },
  {
    channel: 'snapchat',
    hints: ['snapchat', 'snap'],
  },
  {
    channel: 'twitter',
    hints: ['twitter', 'xads', 'x com'],
  },
  {
    channel: 'linkedin',
    hints: ['linkedin'],
  },
  {
    channel: 'youtube',
    hints: ['youtube'],
  },
  {
    channel: 'email',
    hints: ['email', 'newsletter'],
  },
  {
    channel: 'whatsapp',
    hints: ['whatsapp', 'wa'],
  },
];

type TrafficHint = {
  raw: string;
  normalized: string;
  tokens: string[];
};

function normalizeTrafficValue(value: string): TrafficHint {
  const normalized = normalizeTrafficString(value);
  return {
    raw: value,
    normalized,
    tokens: normalized.split(' ').filter(Boolean),
  };
}

function normalizeTrafficValues(values: string[]): TrafficHint[] {
  return values
    .map((value) => (typeof value === 'string' ? value : String(value)))
    .filter((value) => value.trim().length > 0)
    .map(normalizeTrafficValue);
}

function buildTrafficContext(values: string[], params: URLSearchParams | null): TrafficContext {
  const normalized = normalizeTrafficValues(values);
  const tokens = new Set<string>();
  const combined: string[] = [];

  for (const hint of normalized) {
    combined.push(hint.normalized);
    for (const token of hint.tokens) {
      tokens.add(token);
    }
  }

  const paramKeys = new Set<string>();
  const paramTokens = new Set<string>();

  if (params) {
    params.forEach((value, key) => {
      paramKeys.add(key.toLowerCase());
      const normalizedValue = normalizeTrafficString(value);
      if (normalizedValue) {
        paramTokens.add(normalizedValue);
        for (const token of normalizedValue.split(' ').filter(Boolean)) {
          paramTokens.add(token);
        }
      }
    });
  }

  return {
    tokens,
    combined,
    paramKeys,
    paramTokens,
  };
}

function hasTrafficHint(ctx: TrafficContext, hints: string[]): boolean {
  const normalizedHints = hints.map(normalizeTrafficString).filter(Boolean);

  for (const hint of normalizedHints) {
    if (ctx.tokens.has(hint) || ctx.paramTokens.has(hint)) {
      return true;
    }

    if (ctx.paramKeys.has(hint)) {
      return true;
    }

    for (const combined of ctx.combined) {
      if (combined.includes(hint)) {
        return true;
      }
    }
  }

  return false;
}

function joinTrafficParts(parts: string[]): string | null {
  const filtered = parts
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part && part !== 'unknown');

  if (!filtered.length) return null;

  return Array.from(new Set(filtered)).join('.');
}

function resolveChannelFromValue(value: any): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeTrafficString(value);
  if (!normalized) return null;

  for (const group of CHANNEL_HINT_GROUPS) {
    if (group.hints.some((hint) => normalized.includes(hint))) {
      return group.channel;
    }
  }

  return null;
}

function detectChannelFromContext(ctx: TrafficContext): string | null {
  for (const group of CHANNEL_HINT_GROUPS) {
    if (hasTrafficHint(ctx, group.hints)) {
      if (!group.strictTokens || group.strictTokens.some((token) => ctx.tokens.has(token))) {
        return group.channel;
      }
    }
  }

  return null;
}

function detectTrafficClassification(ctx: TrafficContext, params: URLSearchParams | null): string {
  const classifyFromValues = () => {
    if (hasTrafficHint(ctx, ['organic', 'seo', 'blog', 'conteudo', 'content'])) return 'organic';
    if (hasTrafficHint(ctx, ['paid', 'ads', 'midia paga', 'trafego pago'])) return 'paid';
    if (hasTrafficHint(ctx, ['email', 'newsletter'])) return 'email';
    if (hasTrafficHint(ctx, ['referral', 'parceiro', 'afiliado'])) return 'referral';
    if (hasTrafficHint(ctx, ['social', 'social media'])) return 'social';
    return 'unknown';
  };

  const classification = classifyFromValues();
  if (classification !== 'unknown') return classification;

  const detectFromParams = () => {
    if (!params) return 'unknown';
    const lowerCaseParams = new Set<string>();
    params.forEach((_value, key) => lowerCaseParams.add(key.toLowerCase()));

    const directMappings: Record<string, string> = {
      utm_medium: 'medium',
      utm_source: 'source',
      utm_campaign: 'campaign',
    };

    if (Array.from(lowerCaseParams).some((key) => key.includes('utm_medium'))) {
      return 'paid';
    }

    if (Array.from(lowerCaseParams).some((key) => key.includes('utm_source'))) {
      return 'paid';
    }

    for (const [param, target] of Object.entries(directMappings)) {
      if (lowerCaseParams.has(param)) {
        return target;
      }
    }

    return 'unknown';
  };

  return detectFromParams();
}

export function extractTrafficSource(
  body: any,
  checkoutUrl: string | null,
  existingTrafficSource: string | null,
): string | null {
  const params = parseCheckoutSearchParams(checkoutUrl);
  const manualReminder = detectManualReminder(params);

  const sources: string[] = [];
  const mediums: string[] = [];
  const hints: string[] = [];

  const addValue = (collection: string[], value: any) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (collection.includes(trimmed)) return false;
    collection.push(trimmed);
    return true;
  };

  const registerTiktokPixelHint = (value: any, detected: string[]) => {
    if (addValue(hints, value)) {
      addValue(hints, 'tiktok');
      detected.push(String(value).trim());
      return true;
    }
    return false;
  };

  addValue(
    sources,
    pickByKeys(
      body,
      [
        'utm_source',
        'utmSource',
        'trackingparameters.utm_source',
        'traffic_source',
        'campaign_source',
        'source_platform',
        'marketing_source',
      ],
      (v) => typeof v === 'string' && v.trim().length > 0,
    ) as string | null,
  );

  addValue(
    hints,
    pickByKeys(
      body,
      [
        'traffic_channel',
        'trafficChannel',
        'utm_channel',
        'utmChannel',
        'trackingparameters.utm_channel',
        'channel',
      ],
      (v) => typeof v === 'string' && v.trim().length > 0,
    ) as string | null,
  );

  addValue(
    mediums,
    pickByKeys(
      body,
      [
        'utm_medium',
        'utmMedium',
        'trackingparameters.utm_medium',
        'traffic_medium',
        'campaign_medium',
        'marketing_medium',
      ],
      (v) => typeof v === 'string' && v.trim().length > 0,
    ) as string | null,
  );

  addValue(
    hints,
    pickByKeys(
      body,
      [
        'utm_campaign',
        'utmCampaign',
        'trackingparameters.utm_campaign',
        'campaign',
        'campaign_name',
        'campaignName',
      ],
      (v) => typeof v === 'string' && v.trim().length > 0,
    ) as string | null,
  );

  addValue(
    hints,
    pickByKeys(
      body,
      [
        'adset',
        'adset_name',
        'adsetName',
        'adgroup',
        'adgroup_name',
        'adgroupName',
        'ad_name',
        'adName',
      ],
      (v) => typeof v === 'string' && v.trim().length > 0,
    ) as string | null,
  );

  const detectedTikTokPixels: string[] = [];

  for (const key of ['tiktok_pixel_id', 'tt_pixel_id']) {
    registerTiktokPixelHint(
      pickByKeys(body, [key], (v) => typeof v === 'string' && v.trim().length > 0) as string | null,
      detectedTikTokPixels,
    );
  }

  const genericPixelId = pickByKeys(
    body,
    ['pixel_id', 'pixelId'],
    (v) => typeof v === 'string' && v.trim().length > 0,
  ) as string | null;

  if (genericPixelId && /^(tt|bt)/i.test(genericPixelId.trim())) {
    registerTiktokPixelHint(genericPixelId, detectedTikTokPixels);
  }

  addValue(
    hints,
    pickByKeys(body, ['pixel', 'pixel_id', 'pixelId'], (v) =>
      typeof v === 'string' && v.trim().length > 0,
    ) as string | null,
  );

  if (detectedTikTokPixels.length) {
    console.log('[kiwify-webhook] detected TikTok pixel hints', {
      tiktokPixelIds: detectedTikTokPixels,
    });
  }

  for (const key of ['ttclid', 'fbclid', 'gclid', 'msclkid', 'kwai_adid', 'kwaiAdId']) {
    addValue(
      hints,
      pickByKeys(body, [key], (v) => typeof v === 'string' && v.trim().length > 0) as string | null,
    );
  }

  if (params) {
    const param = (key: string) => params.get(key);
    addValue(sources, param('utm_source'));
    addValue(sources, param('source'));
    addValue(sources, param('utm_platform'));
    addValue(sources, param('utm_channel'));
    addValue(sources, param('traffic_source'));
    addValue(mediums, param('utm_medium'));
    addValue(mediums, param('medium'));
    addValue(mediums, param('traffic_medium'));
    addValue(hints, param('utm_campaign'));
    addValue(hints, param('utm_content'));
    addValue(hints, param('utm_term'));
    addValue(hints, param('utm_id'));
    addValue(hints, param('utm_source_platform'));
    addValue(hints, param('adset_name'));
    addValue(hints, param('campaign_name'));
    addValue(hints, param('ttclid'));
    addValue(hints, param('fbclid'));
    addValue(hints, param('gclid'));
    addValue(hints, param('msclkid'));
    addValue(hints, param('kwai_adid'));
  }

  const context = buildTrafficContext([...sources, ...mediums, ...hints], params);
  const mediumContext = buildTrafficContext([...mediums, ...hints], params);

  let channel: string | null = null;
  for (const candidate of [...sources, ...hints]) {
    channel = resolveChannelFromValue(candidate);
    if (channel) break;
  }

  if (!channel) {
    channel = detectChannelFromContext(context);

    if (hasTrafficHint(context, ['tiktok', 'ttclid', 'ttad', 'ttadgroup', 'tiktokads'])) channel = 'tiktok';
    else if (hasTrafficHint(context, ['instagram'])) channel = 'instagram';
    else if (hasTrafficHint(context, ['facebook', 'meta', 'fbclid', 'fbads'])) channel = 'facebook';
    else if (hasTrafficHint(context, ['google', 'gclid', 'adwords', 'googleads'])) channel = 'google';
    else if (hasTrafficHint(context, ['bing', 'msclkid', 'microsoft'])) channel = 'bing';
    else if (hasTrafficHint(context, ['taboola'])) channel = 'taboola';
    else if (hasTrafficHint(context, ['kwai'])) channel = 'kwai';
    else if (hasTrafficHint(context, ['pinterest', 'pin'])) channel = 'pinterest';
    else if (hasTrafficHint(context, ['snapchat', 'snap'])) channel = 'snapchat';
    else if (hasTrafficHint(context, ['twitter', 'xads', 'x com'])) channel = 'twitter';
    else if (hasTrafficHint(context, ['linkedin'])) channel = 'linkedin';
    else if (hasTrafficHint(context, ['youtube'])) channel = 'youtube';
    else if (hasTrafficHint(context, ['email', 'newsletter'])) channel = 'email';
    else if (hasTrafficHint(context, ['whatsapp', 'wa'])) channel = 'whatsapp';
  }

  const classification = detectTrafficClassification(mediumContext, params);

  const candidateParts: string[] = [];
  if (channel) {
    candidateParts.push(channel);
  }
  if (
    classification &&
    classification !== 'unknown' &&
    !candidateParts.includes(classification)
  ) {
    candidateParts.push(classification);
  }

  let candidate = joinTrafficParts(candidateParts);

  if (!candidate) {
    for (const value of sources) {
      const normalized = resolveChannelFromValue(value);
      if (normalized) {
        candidate = normalized;
        break;
      }
    }
  }

  if (!candidate && classification && classification !== 'unknown') {
    candidate = joinTrafficParts([classification]);
  }

  let resolvedCandidate: string | null;

  if (!candidate) {
    resolvedCandidate = existingTrafficSource ?? null;
  } else if (existingTrafficSource && existingTrafficSource !== 'unknown') {
    const existingSpecific = existingTrafficSource.includes('.');
    const candidateSpecific = candidate.includes('.');
    resolvedCandidate = !candidateSpecific && existingSpecific ? existingTrafficSource : candidate;
  } else {
    resolvedCandidate = candidate;
  }

  if (manualReminder === 'email') {
    const normalizeCandidate = (value: string | null | undefined): string | null => {
      if (typeof value !== 'string') return null;
      const normalized = value.trim().toLowerCase();
      if (!normalized || normalized === 'unknown') return null;
      return normalized;
    };

    const resolvedNormalized = normalizeCandidate(resolvedCandidate);
    const existingNormalized = normalizeCandidate(existingTrafficSource);
    const candidateNormalized = normalizeCandidate(candidate);

    const isEmailLike = (value: string | null) =>
      !value ? false : value === 'email' || value.endsWith('.email');

    const baseCandidate =
      (resolvedNormalized && !isEmailLike(resolvedNormalized) && resolvedNormalized) ||
      (existingNormalized && !isEmailLike(existingNormalized) && existingNormalized) ||
      (candidateNormalized && !isEmailLike(candidateNormalized) && candidateNormalized) ||
      (existingNormalized && existingNormalized !== 'email' && existingNormalized) ||
      null;

    const baseParts = baseCandidate
      ? baseCandidate
          .split('.')
          .map((part) => part.trim())
          .filter((part) => part && part !== 'email')
      : [];

    const hasClassification = baseParts.some((part) => part === 'paid' || part === 'organic');
    const normalizedClassification = normalizeCandidate(classification);
    const classificationToken =
      normalizedClassification && (normalizedClassification === 'paid' || normalizedClassification === 'organic')
        ? normalizedClassification
        : null;

    if (!baseParts.length) {
      baseParts.push(classificationToken ?? 'organic');
    } else if (!hasClassification) {
      baseParts.push(classificationToken ?? 'organic');
    }

    const manualSource = joinTrafficParts([...baseParts, 'email']);
    return manualSource ?? 'organic.email';
  }

  return resolvedCandidate;
}

