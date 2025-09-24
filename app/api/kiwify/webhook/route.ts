// app/api/kiwify/webhook/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { readEnvValue } from '../../../../lib/env';

// ==== ENVS OBRIGATÓRIAS ====
// ==== ENVS OPCIONAIS ====
const DEFAULT_DELAY_HOURS =
  Number(
    (process.env.DEFAULT_DELAY_HOURS ?? process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()
  ) || 24;

// Se você configurar a assinatura da Kiwify:
const KIWIFY_WEBHOOK_SECRET = (process.env.KIWIFY_WEBHOOK_SECRET ?? '').trim();
// Se quiser bloquear quando a assinatura não bater:
const STRICT_SIGNATURE =
  (process.env.KIWIFY_STRICT_SIGNATURE ?? 'false').toLowerCase() === 'true';

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function deepWalk(
  obj: any,
  visit: (k: string, v: any, path: string[]) => boolean,
  path: string[] = []
): boolean {
  if (obj === null || obj === undefined) return false;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (deepWalk(obj[i], visit, [...path, String(i)])) return true;
    }
    return false;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (visit(k, v, [...path, k]) || deepWalk(v, visit, [...path, k])) return true;
    }
    return false;
  }
  return false;
}

function pickByKeys(
  obj: any,
  keys: string[],
  test?: (v: any) => boolean
): any | null {
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  let found: any = null;
  deepWalk(obj, (k, v) => {
    if (
      normalizedKeys.some((key) => k.toLowerCase() === key) &&
      (test ? test(v) : v != null)
    ) {
      found = v;
      return true;
    }
    return false;
  });
  return found;
}

function findEmailDeep(obj: any): string | null {
  const byKey = pickByKeys(
    obj,
    ['email', 'customer_email', 'buyer_email', 'user_email', 'mail'],
    (v) => typeof v === 'string' && EMAIL_RE.test(v)
  );
  if (byKey) return String(byKey);

  let found: string | null = null;
  deepWalk(obj, (_k, v) => {
    if (typeof v === 'string' && EMAIL_RE.test(v)) {
      found = v;
      return true;
    }
    return false;
  });
  return found;
}

function findNameDeep(obj: any): string | null {
  const keys = ['name', 'customer_name', 'buyer_name', 'full_name', 'username'];
  const byKey = pickByKeys(
    obj,
    keys,
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  if (byKey) return String(byKey).trim();

  let found: string | null = null;
  deepWalk(obj, (k, v) => {
    if (
      typeof v === 'string' &&
      k.toLowerCase().includes('name') &&
      !EMAIL_RE.test(v) &&
      v.trim().length > 0
    ) {
      found = v.trim();
      return true;
    }
    return false;
  });
  return found;
}

// ====== PATCH DEFINITIVO: produto sem confundir com nome do cliente ======
function findProductNameDeep(obj: any): string | null {
  // 1) Preferência alta: campos explícitos de produto/offer
  const preferred = pickByKeys(
    obj,
    ['product_name', 'offer_name', 'product_title', 'item_title', 'course_name', 'plan_name'],
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  if (preferred) return String(preferred).trim();

  // 2) product.{title|name}
  let found: string | null = null;
  deepWalk(obj, (k, v, path) => {
    if (typeof v !== 'string' || !v.trim()) return false;
    const key = k.toLowerCase();
    const p = path.join('.').toLowerCase();

    // Só aceita name/title se o caminho indicar produto/itens (evita cart.name, customer.name, etc.)
    const looksLikeProductPath =
      /(^|\.)(product|products|item|items|order_items|line_items|order_products)(\.|$)/i.test(p);

    if (looksLikeProductPath && (key === 'title' || key === 'name')) {
      found = v.trim();
      return true;
    }
    return false;
  });
  if (found) return found;

  // 3) Fallback em arrays comuns (primeiro título/nome de item)
  const listKeys = ['order_items', 'items', 'products', 'order_products', 'line_items', 'purchases', 'courses'];
  for (const lk of listKeys) {
    const arr = pickByKeys(obj, [lk], (v) => Array.isArray(v)) as any[] | null;
    if (arr && arr.length) {
      for (const it of arr) {
        if (!it) continue;
        if (typeof it.title === 'string' && it.title.trim()) return it.title.trim();
        if (typeof it.name  === 'string' && it.name.trim())  return it.name.trim();
        if (it.product) {
          if (typeof it.product.title === 'string' && it.product.title.trim()) return it.product.title.trim();
          if (typeof it.product.name  === 'string' && it.product.name.trim())  return it.product.name.trim();
        }
      }
    }
  }

  // 4) Indicativos (nunca 'name' genérico)
  const alt = pickByKeys(
    obj,
    ['product_type', 'plan_type', 'order_ref'],
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  return alt ? String(alt).trim() : null;
}

function normalizeIdCandidate(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function findProductIdDeep(obj: any): string | null {
  const preferred = pickByKeys(
    obj,
    [
      'product_id',
      'productId',
      'offer_id',
      'offerId',
      'plan_id',
      'planId',
      'course_id',
      'courseId',
      'item_id',
      'itemId',
      'product_code',
      'productCode',
      'sku',
      'product_slug',
      'productSlug',
    ],
    (v) => normalizeIdCandidate(v) !== null
  );
  if (preferred != null) {
    const normalized = normalizeIdCandidate(preferred);
    if (normalized) return normalized;
  }

  let found: string | null = null;
  deepWalk(obj, (k, v, path) => {
    const normalized = normalizeIdCandidate(v);
    if (!normalized) return false;

    const key = k.toLowerCase();
    const p = path.join('.').toLowerCase();
    const looksLikeProductPath =
      /(^|\.)(product|products|item|items|order_items|line_items|order_products|purchases|courses)(\.|$)/i.test(p);

    if (
      looksLikeProductPath &&
      ['id', 'product_id', 'productid', 'offer_id', 'offerid', 'sku', 'code', 'slug'].includes(key)
    ) {
      found = normalized;
      return true;
    }
    return false;
  });
  if (found) return found;

  const listKeys = ['order_items', 'items', 'products', 'order_products', 'line_items', 'purchases', 'courses'];
  for (const lk of listKeys) {
    const arr = pickByKeys(obj, [lk], (v) => Array.isArray(v)) as any[] | null;
    if (!arr || !arr.length) continue;
    for (const it of arr) {
      if (!it) continue;
      const direct = normalizeIdCandidate((it as any).product_id ?? (it as any).id ?? (it as any).sku);
      if (direct) return direct;
      if ((it as any).product) {
        const nested = normalizeIdCandidate(
          (it as any).product.product_id ??
            (it as any).product.id ??
            (it as any).product.sku ??
            (it as any).product.code
        );
        if (nested) return nested;
      }
    }
  }

  return null;
}

// ====== checkout_url (monta a partir de checkout_link se precisar) ======
function findCheckoutUrlDeep(obj: any): string | null {
  // URL direta
  const byKey = pickByKeys(
    obj,
    ['checkout_url', 'payment_link', 'url'],
    (v) => typeof v === 'string' && v.startsWith('http')
  );
  if (byKey) return String(byKey);

  // links.checkout
  const links = pickByKeys(obj, ['links'], (v) => typeof v === 'object');
  if (links && typeof (links as any).checkout === 'string' && (links as any).checkout.startsWith('http'))
    return (links as any).checkout;

  // código curto -> URL
  const code = pickByKeys(
    obj,
    ['checkout_link', 'link', 'code'],
    (v) => typeof v === 'string' && /^[A-Za-z0-9]{5,20}$/.test(v)
  );
  if (code) return `https://pay.kiwify.com.br/${String(code)}`;

  // qualquer http (prioriza kiwify)
  let best: string | null = null;
  deepWalk(obj, (_k, v) => {
    if (typeof v === 'string' && v.startsWith('http')) {
      if (/kiwify\.com\.br|pay\.kiwify/i.test(v)) { best = v; return true; }
      if (!best) best = v;
    }
    return false;
  });
  return best;
}

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
    hints: [
      'instagram',
      'instagramads',
      'igads',
      'igad',
      'instaads',
      'instaad',
      'igstory',
      'igreels',
      'igcampaign',
    ],
    strictTokens: ['instagram', 'insta', 'ig'],
  },
  {
    channel: 'facebook',
    hints: [
      'facebook',
      'facebookads',
      'fbads',
      'fbadset',
      'fbcampaign',
      'fbclid',
      'meta ads',
      'metaads',
      'metapixel',
      'metacampaign',
    ],
    strictTokens: ['facebook', 'fb', 'meta'],
  },
  {
    channel: 'google',
    hints: ['google', 'googleads', 'adwords', 'gads', 'gclid', 'sem', 'searchads'],
    strictTokens: ['google'],
  },
  {
    channel: 'bing',
    hints: ['bing', 'bingads', 'msclkid', 'microsoft'],
    strictTokens: ['bing'],
  },
  { channel: 'taboola', hints: ['taboola'], strictTokens: ['taboola'] },
  {
    channel: 'kwai',
    hints: ['kwai', 'kwaiadid', 'kwaiads'],
    strictTokens: ['kwai'],
  },
  {
    channel: 'pinterest',
    hints: ['pinterest', 'pinads'],
    strictTokens: ['pinterest'],
  },
  {
    channel: 'snapchat',
    hints: ['snapchat', 'snap ads', 'snapads', 'snap'],
    strictTokens: ['snapchat', 'snap'],
  },
  {
    channel: 'twitter',
    hints: ['twitter', 'xads', 'x com', 'x.com', 'twitterads'],
    strictTokens: ['twitter'],
  },
  { channel: 'linkedin', hints: ['linkedin'], strictTokens: ['linkedin'] },
  {
    channel: 'youtube',
    hints: ['youtube', 'youtubeads', 'ytads', 'yt campaign'],
    strictTokens: ['youtube', 'yt'],
  },
  {
    channel: 'email',
    hints: ['email', 'newsletter', 'mailing'],
    strictTokens: ['email'],
  },
  {
    channel: 'whatsapp',
    hints: ['whatsapp', 'zap', 'wpp', 'whats'],
    strictTokens: ['whatsapp', 'zap', 'wpp'],
  },
];

function buildTrafficContext(values: string[], params: URLSearchParams | null): TrafficContext {
  const tokens = new Set<string>();
  const combined: string[] = [];
  const paramKeys = new Set<string>();
  const paramTokens = new Set<string>();

  const addValue = (raw: string | null | undefined) => {
    if (!raw) return;
    const normalized = normalizeTrafficString(String(raw));
    if (!normalized) return;
    combined.push(normalized);
    for (const token of normalized.split(' ')) {
      if (token) tokens.add(token);
    }
  };

  for (const value of values) {
    addValue(value);
  }

  if (params) {
    for (const [key, value] of Array.from(params.entries())) {
      const lowerKey = key.toLowerCase();
      paramKeys.add(lowerKey);
      addValue(lowerKey);
      addValue(value);
      for (const token of lowerKey.split(/[^a-z0-9]+/)) {
        if (token) paramTokens.add(token);
      }
      for (const token of value.toLowerCase().split(/[^a-z0-9]+/)) {
        if (token) paramTokens.add(token);
      }
    }
  }

  return { tokens, combined, paramKeys, paramTokens };
}

function hasTrafficHint(ctx: TrafficContext, hints: string[]): boolean {
  for (const hint of hints) {
    const normalized = normalizeTrafficString(hint);
    if (!normalized) continue;
    const tokens = normalized.split(' ');
    if (tokens.some((token) => ctx.tokens.has(token) || ctx.paramTokens.has(token))) {
      return true;
    }
    const compact = normalized.replace(/ /g, '');
    if (compact && ctx.paramKeys.has(compact)) {
      return true;
    }
    if (ctx.paramKeys.has(hint.toLowerCase())) {
      return true;
    }
    for (const value of ctx.combined) {
      if (value.includes(normalized)) return true;
    }
  }
  return false;
}

function contextHasToken(ctx: TrafficContext, token: string): boolean {
  const normalized = normalizeTrafficString(token);
  if (!normalized) return false;
  if (ctx.tokens.has(normalized) || ctx.paramTokens.has(normalized)) {
    return true;
  }
  const compact = normalized.replace(/ /g, '');
  if (compact && ctx.paramKeys.has(compact)) {
    return true;
  }
  if (ctx.paramKeys.has(token.toLowerCase())) {
    return true;
  }
  return false;
}

function detectChannelFromContext(ctx: TrafficContext): string | null {
  for (const group of CHANNEL_HINT_GROUPS) {
    const strictMatch = group.strictTokens?.some((token) => contextHasToken(ctx, token));
    if (strictMatch || hasTrafficHint(ctx, group.hints)) {
      return group.channel;
    }
  }
  return null;
}

function joinTrafficParts(parts: Array<string | null | undefined>): string | null {
  const normalized = parts
    .map((part) => (typeof part === 'string' ? part : null))
    .filter((part): part is string => !!part && !!part.trim())
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/\.+/g, '.')
        .replace(/^\.+|\.+$/g, '')
    )
    .filter(Boolean);

  if (!normalized.length) return null;
  return normalized.join('.');
}

function resolveChannelFromValue(value: string): string | null {
  const normalized = normalizeTrafficString(value);
  if (!normalized) return null;

  const context = buildTrafficContext([value], null);
  const channelFromHints = detectChannelFromContext(context);
  if (channelFromHints) return channelFromHints;
  if (/\baffiliate\b/.test(` ${normalized} `) || /\bafiliad[oa]\b/.test(` ${normalized} `) || /\bparceria\b/.test(` ${normalized} `)) {
    return 'affiliate';
  }

  const padded = ` ${normalized} `;
  if (/\btiktok\b/.test(padded) || normalized.includes('tiktokad')) return 'tiktok';
  if (/\binstagram\b/.test(padded)) return 'instagram';
  if (/\bfacebook\b/.test(padded) || /\bmeta\b/.test(padded) || padded.includes(' fb ')) return 'facebook';
  if (/\bgoogle\b/.test(padded) || /\badwords\b/.test(padded) || /\bgads\b/.test(padded)) return 'google';
  if (/\bbing\b/.test(padded) || /\bmicrosoft\b/.test(padded)) return 'bing';
  if (/\bkwai\b/.test(padded)) return 'kwai';
  if (/\btaboola\b/.test(padded)) return 'taboola';
  if (/\bpinterest\b/.test(padded)) return 'pinterest';
  if (/\bsnap(chat)?\b/.test(padded) || padded.includes(' snap ')) return 'snapchat';
  if (/\btwitter\b/.test(padded) || /\bxads?\b/.test(padded) || normalized.includes('x.com')) return 'twitter';
  if (/\blinked?in\b/.test(padded)) return 'linkedin';
  if (/\byoutube\b/.test(padded)) return 'youtube';
  if (/\bwhatsapp\b/.test(padded) || padded.includes(' wa ')) return 'whatsapp';
  if (/\bemail\b/.test(padded) || normalized.includes('newsletter')) return 'email';
  if (/\baffiliate\b/.test(padded) || /\bafiliad[oa]\b/.test(padded) || /\bparceria\b/.test(padded)) return 'affiliate';
  if (/\borganic\b/.test(padded)) return 'organic';
  if (/\bdirect\b/.test(padded)) return 'direct';

  const slug = normalized.replace(/[^a-z0-9]+/g, '.').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
  return slug || null;
}

function detectTrafficClassification(ctx: TrafficContext, params: URLSearchParams | null): string {
  const affiliateTokens = [
    'affiliate',
    'affiliates',
    'afiliado',
    'afiliada',
    'afiliados',
    'afiliadas',
    'afiliacao',
    'parceria',
    'parceiro',
    'parceira',
  ];
  if (hasTrafficHint(ctx, affiliateTokens)) return 'affiliate';

  const emailTokens = ['email', 'newsletter', 'mailing'];
  if (hasTrafficHint(ctx, emailTokens)) return 'email';

  const referralTokens = ['referral', 'indicacao', 'indication', 'referencia', 'referido'];
  if (hasTrafficHint(ctx, referralTokens)) return 'referral';

  const organicTokens = ['organic', 'organico', 'gratis', 'free', 'seo', 'blog', 'conteudo', 'content', 'direct'];
  const hasOrganicHint = hasTrafficHint(ctx, organicTokens);

  const paidTokens = [
    'paid',
    'pago',
    'midia paga',
    'midiapaga',
    'trafego pago',
    'trafegopago',
    'ads',
    'ad',
    'cpc',
    'cpa',
    'cpp',
    'cpm',
    'ppc',
    'display',
    'remarketing',
    'retargeting',
    'sponsored',
    'paid social',
    'paid search',
  ];

  const paidParamIndicators = ['fbclid', 'gclid', 'msclkid', 'kwai', 'adset', 'adgroup', 'campaign_id', 'ad_id'];
  const hasPaidParam = params
    ? Array.from(params.keys()).some((key) =>
        paidParamIndicators.some((indicator) => key.toLowerCase().includes(indicator))
      )
    : false;
  const hasPaidHint = hasTrafficHint(ctx, paidTokens);

  const tiktokTokens = ['tiktok', 'ttclid', 'ttad', 'ttadgroup', 'tiktokads'];
  const hasTiktokHint = hasTrafficHint(ctx, tiktokTokens);

  if (hasOrganicHint) return 'organic';

  if (hasTiktokHint && !hasPaidHint && !hasPaidParam) {
    return 'organic';
  }

  if (hasPaidHint || hasPaidParam) return 'paid';

  if (hasTiktokHint) return 'organic';

  return 'unknown';
}

function extractTrafficSource(
  body: any,
  checkoutUrl: string | null,
  existingTrafficSource: string | null
): string | null {
  const params = parseCheckoutSearchParams(checkoutUrl);

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
    pickByKeys(body, ['utm_source', 'utmSource', 'traffic_source', 'campaign_source', 'source_platform', 'marketing_source'], (v) =>
      typeof v === 'string' && v.trim().length > 0
    ) as string | null
  );

  addValue(
    hints,
    pickByKeys(body, ['traffic_channel', 'trafficChannel', 'utm_channel', 'utmChannel', 'channel'], (v) =>
      typeof v === 'string' && v.trim().length > 0
    ) as string | null
  );

  addValue(
    mediums,
    pickByKeys(body, ['utm_medium', 'utmMedium', 'traffic_medium', 'campaign_medium', 'marketing_medium'], (v) =>
      typeof v === 'string' && v.trim().length > 0
    ) as string | null
  );

  addValue(
    hints,
    pickByKeys(body, ['utm_campaign', 'utmCampaign', 'campaign', 'campaign_name', 'campaignName'], (v) =>
      typeof v === 'string' && v.trim().length > 0
    ) as string | null
  );

  addValue(
    hints,
    pickByKeys(body, ['adset', 'adset_name', 'adsetName', 'adgroup', 'adgroup_name', 'adgroupName', 'ad_name', 'adName'], (v) =>
      typeof v === 'string' && v.trim().length > 0
    ) as string | null
  );

  const detectedTikTokPixels: string[] = [];

  for (const key of ['tiktok_pixel_id', 'tt_pixel_id']) {
    registerTiktokPixelHint(
      pickByKeys(body, [key], (v) => typeof v === 'string' && v.trim().length > 0) as string | null,
      detectedTikTokPixels
    );
  }

  const genericPixelId = pickByKeys(
    body,
    ['pixel_id', 'pixelId'],
    (v) => typeof v === 'string' && v.trim().length > 0
  ) as string | null;

  if (genericPixelId && /^(tt|bt)/i.test(genericPixelId.trim())) {
    registerTiktokPixelHint(genericPixelId, detectedTikTokPixels);
  }

  addValue(
    hints,
    pickByKeys(body, ['pixel', 'pixel_id', 'pixelId'], (v) =>
      typeof v === 'string' && v.trim().length > 0
    ) as string | null
  );

  if (detectedTikTokPixels.length) {
    console.log('[kiwify-webhook] detected TikTok pixel hints', {
      tiktokPixelIds: detectedTikTokPixels,
    });
  }

  for (const key of ['ttclid', 'fbclid', 'gclid', 'msclkid', 'kwai_adid', 'kwaiAdId']) {
    addValue(
      hints,
      pickByKeys(body, [key], (v) => typeof v === 'string' && v.trim().length > 0) as string | null
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

  if (!candidate) {
    return existingTrafficSource ?? null;
  }

  if (existingTrafficSource && existingTrafficSource !== 'unknown') {
    const existingSpecific = existingTrafficSource.includes('.');
    const candidateSpecific = candidate.includes('.');
    if (!candidateSpecific && existingSpecific) {
      return existingTrafficSource;
    }
  }

  return candidate;
}

function findDiscountDeep(obj: any): string | null {
  const byKey = pickByKeys(
    obj,
    ['discount_code', 'coupon', 'coupon_code', 'voucher', 'promo_code'],
    (v) => typeof v === 'string' && v.trim().length > 0
  );
  return byKey ? String(byKey).trim() : null;
}

type CheckoutIdResolution = {
  primary: string;
  candidates: string[];
};

function normalizeCheckoutCodeCandidate(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^[A-Za-z0-9_-]{4,120}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    if (trimmed.startsWith('http')) {
      try {
        const url = new URL(trimmed);
        const segments = url.pathname.split('/').filter(Boolean);
        const last = segments.pop();
        if (last && /^[A-Za-z0-9_-]{4,120}$/.test(last)) {
          return last.toLowerCase();
        }
      } catch {
        // ignore parsing errors
      }
    }
  }
  return null;
}

function findCheckoutCodeDeep(obj: any): string | null {
  const direct = pickByKeys(
    obj,
    ['checkout_link', 'checkout_code', 'checkoutCode', 'cart_code', 'cartCode'],
    (v) => normalizeCheckoutCodeCandidate(v) !== null
  );
  if (direct != null) {
    const normalized = normalizeCheckoutCodeCandidate(direct);
    if (normalized) return normalized;
  }

  const url = findCheckoutUrlDeep(obj);
  if (url) {
    const normalized = normalizeCheckoutCodeCandidate(url);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeProductComponent(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findCheckoutIdDeep(
  obj: any,
  opts?: { email?: string | null; productId?: string | null; productTitle?: string | null }
): CheckoutIdResolution {
  const direct = pickByKeys(
    obj,
    ['checkout_id', 'purchase_id', 'order_id', 'cart_id', 'id', 'order_ref'],
    (v) => v !== null && v !== undefined
  );

  const email = opts?.email?.trim().toLowerCase() ?? null;
  const productComponent =
    normalizeProductComponent(opts?.productId) ?? normalizeProductComponent(opts?.productTitle);
  const checkoutCode = findCheckoutCodeDeep(obj);

  const seeds: string[] = [];
  if (email && checkoutCode) {
    seeds.push(`${email}::checkout::${checkoutCode}`);
  }
  if (email && productComponent) {
    seeds.push(`${email}::product::${productComponent}`);
  }
  if (productComponent && checkoutCode) {
    seeds.push(`product::${productComponent}::checkout::${checkoutCode}`);
  }

  const hashedCandidates = seeds.map((seed) =>
    crypto.createHash('sha256').update(seed).digest('hex')
  );

  const candidates = Array.from(
    new Set([
      ...hashedCandidates,
      direct != null ? String(direct) : null,
    ].filter((value): value is string => Boolean(value)))
  );

  if (!candidates.length) {
    const generated = crypto.randomUUID();
    return { primary: generated, candidates: [generated] };
  }

  return { primary: candidates[0], candidates };
}

function toTimestamp(value: any): number {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function pickPreferredExisting(
  rows: any[],
  candidateIds: Iterable<string>
): any | null {
  if (!rows.length) return null;
  const candidateSet = new Set(
    Array.from(candidateIds)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((value) => value.trim())
  );

  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const row of rows) {
    if (!row) continue;
    const key =
      (typeof row.id === 'string' && row.id) ||
      (typeof row.checkout_id === 'string' && row.checkout_id) ||
      `${row.customer_email ?? ''}::${row.product_id ?? ''}::${row.product_title ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const pickBetter = (current: any, candidate: any) => {
    if (!current) return candidate;
    if (!candidate) return current;

    const currentPaid = Boolean(current.paid) || current.status === 'converted';
    const candidatePaid = Boolean(candidate.paid) || candidate.status === 'converted';
    if (candidatePaid !== currentPaid) {
      return candidatePaid ? candidate : current;
    }

    const currentMatchesCandidateId =
      typeof current.checkout_id === 'string' && candidateSet.has(current.checkout_id);
    const candidateMatchesCandidateId =
      typeof candidate.checkout_id === 'string' && candidateSet.has(candidate.checkout_id);
    if (candidateMatchesCandidateId !== currentMatchesCandidateId) {
      return candidateMatchesCandidateId ? candidate : current;
    }

    const currentTimestamp = Math.max(
      toTimestamp(current.updated_at),
      toTimestamp(current.created_at)
    );
    const candidateTimestamp = Math.max(
      toTimestamp(candidate.updated_at),
      toTimestamp(candidate.created_at)
    );
    if (candidateTimestamp !== currentTimestamp) {
      return candidateTimestamp > currentTimestamp ? candidate : current;
    }

    return current;
  };

  return deduped.reduce(pickBetter, null);
}

function interpretBoolean(value: any): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'sim', 'pago', 'aprovado'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'não', 'nao', 'cancelado'].includes(normalized)) return false;
  }
  return null;
}

function normalizeTimestampInput(value: any): string | null {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    const iso = value.toISOString();
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }
  if (typeof value === 'number') {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && trimmed.replace(/[^0-9]/g, '').length >= 10) {
      const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function findPaidAtDeep(obj: any): string | null {
  const keys = [
    'paid_at',
    'paidAt',
    'payment_date',
    'paymentDate',
    'payment_at',
    'paymentAt',
    'approved_at',
    'approvedAt',
    'completed_at',
    'completedAt',
    'concluded_at',
    'concludedAt',
    'finished_at',
    'finishedAt',
    'confirmed_at',
    'confirmedAt',
    'captured_at',
    'capturedAt',
  ];
  const raw = pickByKeys(obj, keys, (v) => v != null && v !== '');
  return normalizeTimestampInput(raw);
}

const POSITIVE_STATUS_KEYWORDS = [
  'approved',
  'aprovado',
  'aprovada',
  'paid',
  'pago',
  'paga',
  'completed',
  'completo',
  'completa',
  'concluded',
  'concluido',
  'concluida',
  'finished',
  'finalizado',
  'finalizada',
  'captured',
  'capturado',
  'capturada',
  'succeeded',
  'success',
  'sucesso',
  'liquidado',
  'liquidada',
  'confirmed',
  'confirmado',
  'confirmada',
  'credited',
  'creditado',
  'creditada',
];

const NEGATIVE_STATUS_KEYWORDS = [
  'pending',
  'pendente',
  'aguardando',
  'waiting',
  'open',
  'unpaid',
  'cancelled',
  'canceled',
  'cancelado',
  'cancelada',
  'refused',
  'rejected',
  'rejeitado',
  'rejeitada',
  'failed',
  'erro',
  'error',
  'chargeback',
  'refunded',
  'devolvido',
  'estornado',
  'analysis',
  'analise',
];

function normalizeKeywordString(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9á-úà-ùãõç]+/gi, ' ')
    .normalize('NFD')
    .replace(/[^a-z0-9 ]/gi, '');
}

function hasKeyword(value: string, keywords: string[]): boolean {
  const normalized = normalizeKeywordString(value);
  if (!normalized) return false;
  const tokens = new Set(normalized.split(' ').filter(Boolean));
  for (const kw of keywords) {
    if (tokens.has(kw)) return true;
    if (normalized.includes(kw)) return true;
  }
  return false;
}

function extractPaymentMeta(body: any) {
  const eventKeys = ['event', 'event_name', 'type', 'name', 'action'];
  const statusKeys = [
    'status',
    'payment_status',
    'order_status',
    'sale_status',
    'state',
    'situation',
    'current_status',
  ];
  const booleanKeys = [
    'paid',
    'is_paid',
    'has_paid',
    'payment_confirmed',
    'is_concluded',
    'is_approved',
  ];

  const seen = new Set<string>();
  const statusCandidates: string[] = [];
  let eventName: string | null = null;

  for (const key of eventKeys) {
    const value = pickByKeys(body, [key], (v) => typeof v === 'string' && v.trim().length > 0);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!eventName) eventName = trimmed;
    }
  }

  for (const key of statusKeys) {
    const value = pickByKeys(body, [key], (v) => typeof v === 'string' && v.trim().length > 0);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!seen.has(trimmed)) {
        statusCandidates.push(trimmed);
        seen.add(trimmed);
      }
    }
  }

  let paid = false;
  let negative = false;

  for (const candidate of [eventName, ...statusCandidates]) {
    if (!candidate) continue;
    if (hasKeyword(candidate, NEGATIVE_STATUS_KEYWORDS)) {
      negative = true;
    }
    if (hasKeyword(candidate, POSITIVE_STATUS_KEYWORDS)) {
      paid = true;
    }
  }

  if (paid && negative) {
    // Prefer explicit boolean flag quando há conflito de palavras-chave
    paid = false;
  }

  for (const key of booleanKeys) {
    const value = pickByKeys(body, [key], (v) => v !== null && v !== undefined);
    const interpreted = interpretBoolean(value);
    if (interpreted === true) {
      paid = true;
      break;
    }
  }

  const paidAt = paid ? findPaidAtDeep(body) : null;

  return {
    paid,
    paidAt,
    eventName,
    statusHint: statusCandidates[0] ?? null,
  } as const;
}

function normalizeSig(sig: string) {
  return sig.startsWith('sha256=') ? sig.slice(7) : sig;
}
function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  try { return crypto.timingSafeEqual(A, B); } catch { return false; }
}

// ---------- Handler ----------
export async function POST(req: Request) {
  const url = new URL(req.url);
  const ct = (req.headers.get('content-type') || '').toLowerCase();

  // 1) RAW + parse (JSON / form)
  const raw = await req.text();
  let body: any = {};
  try {
    if (ct.includes('application/json')) body = raw ? JSON.parse(raw) : {};
    else if (ct.includes('application/x-www-form-urlencoded'))
      body = Object.fromEntries(new URLSearchParams(raw));
    else body = raw ? JSON.parse(raw) : {};
  } catch { body = { raw }; }

  // log leve (útil em produção)
  try {
    const sampleHeaders = Object.fromEntries(
      Array.from(req.headers.entries())
        .filter(([k]) => /^x-|content-|user-agent|accept/i.test(k))
        .slice(0, 12)
    );
    const rootKeys = Object.keys(body || {}).slice(0, 12);
    console.log('[kiwify-webhook] hit', { ct, hasBody: !!raw, rootKeys, sampleHeaders });
  } catch {}

  // 2) assinatura (header OU ?signature=) — se você usa secret
  if (KIWIFY_WEBHOOK_SECRET) {
    const providedRaw =
      req.headers.get('x-kiwify-signature') ||
      req.headers.get('x-signature') ||
      url.searchParams.get('signature') ||
      '';
    if (!providedRaw) {
      console.warn('[kiwify-webhook] missing signature');
      return NextResponse.json({ ok: false, error: 'missing_signature' }, { status: 401 });
    }
    const h = crypto.createHmac('sha256', KIWIFY_WEBHOOK_SECRET).update(raw, 'utf8');
    const expectedHex = h.digest('hex');
    const expectedB64 = Buffer.from(expectedHex, 'hex').toString('base64');
    const provided = normalizeSig(providedRaw);
    const ok = safeEq(provided, expectedHex) || safeEq(provided, expectedB64);
    if (!ok) {
      const msg = '[kiwify-webhook] signature mismatch';
      if (STRICT_SIGNATURE) {
        console.warn(msg + ' (blocking)');
        return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
      } else {
        console.warn(msg + ' (continuing; STRICT_SIGNATURE=false)');
      }
    }
  }

  // 3) Extrai campos
  const email = findEmailDeep(body);
  if (!email) {
    console.warn('[kiwify-webhook] missing_email after deep scan');
    return NextResponse.json({ ok: false, error: 'missing_email' }, { status: 400 });
  }
  const nameFromPayload = findNameDeep(body);
  const productTitleFromPayload = findProductNameDeep(body);
  const productIdFromPayload = findProductIdDeep(body);
  const checkoutUrlFromPayload = findCheckoutUrlDeep(body);
  const discountCodeFromPayload = findDiscountDeep(body);
  const checkoutIdResolution = findCheckoutIdDeep(body, {
    email,
    productId: productIdFromPayload,
    productTitle: productTitleFromPayload,
  });
  const canonicalCheckoutId = checkoutIdResolution.primary;
  const checkoutIdCandidates = checkoutIdResolution.candidates;
  let checkoutId = canonicalCheckoutId;

  const now = new Date();

  const supabaseUrl = readEnvValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceRoleKey = readEnvValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missingEnv: string[] = [];
    if (!supabaseUrl) missingEnv.push('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceRoleKey) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY');

    console.error('[kiwify-webhook] missing environment variables', missingEnv);
    return NextResponse.json(
      { ok: false, error: 'configuration_error', missing: missingEnv },
      { status: 500 },
    );
  }

  // 4) Upsert no Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const selectColumns =
    'id, checkout_id, paid, paid_at, status, created_at, updated_at, schedule_at, last_event, checkout_url, discount_code, source, traffic_source, customer_name, product_title, product_id';

  let existing: any = null;

  if (checkoutIdCandidates.length) {
    const { data, error } = await supabase
      .from('abandoned_emails')
      .select(selectColumns)
      .in('checkout_id', checkoutIdCandidates)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('[kiwify-webhook] failed to load existing record', error);
    } else {
      existing = data;
    }
  }

  if (!existing) {
    const buildBaseQuery = () =>
      supabase
        .from('abandoned_emails')
        .select(selectColumns)
        .eq('customer_email', email)
        .order('updated_at', { ascending: false });

    const fallbackQueries = [] as ReturnType<typeof buildBaseQuery>[];

    if (productIdFromPayload) {
      fallbackQueries.push(buildBaseQuery().eq('product_id', productIdFromPayload));
    }
    if (productTitleFromPayload) {
      fallbackQueries.push(buildBaseQuery().eq('product_title', productTitleFromPayload));
    }
    if (checkoutUrlFromPayload) {
      fallbackQueries.push(buildBaseQuery().eq('checkout_url', checkoutUrlFromPayload));
    }

    // Consulta genérica por email (sem outros filtros)
    fallbackQueries.push(buildBaseQuery());

    const fallbackRows: any[] = [];

    for (const query of fallbackQueries) {
      const { data, error } = await query.limit(20);
      if (error) {
        console.warn('[kiwify-webhook] fallback lookup failed', error);
        continue;
      }
      if (Array.isArray(data)) {
        fallbackRows.push(...data);
      } else if (data) {
        fallbackRows.push(data);
      }
    }

    if (fallbackRows.length) {
      existing = pickPreferredExisting(fallbackRows, checkoutIdCandidates) ?? existing;
    }
  }

  // Se encontrou registro com outro checkout_id, tenta migrar para o canônico
  if (existing?.id && existing.checkout_id && existing.checkout_id !== checkoutId) {
    console.log('[kiwify-webhook] migrating checkout_id to canonical value', {
      previous: existing.checkout_id,
      canonical: checkoutId,
      existingId: existing.id,
    });

    const { error: migrateError } = await supabase
      .from('abandoned_emails')
      .update({ checkout_id: checkoutId })
      .eq('id', existing.id);

    if (migrateError) {
      console.warn('[kiwify-webhook] failed to migrate checkout_id', migrateError, {
        id: existing.id,
        from: existing.checkout_id,
        to: checkoutId,
      });

      // Em caso de conflito de unique, busca a linha "canônica" e escolhe a melhor
      const { data: canonicalRow, error: canonicalError } = await supabase
        .from('abandoned_emails')
        .select(selectColumns)
        .eq('checkout_id', checkoutId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (canonicalError) {
        console.warn('[kiwify-webhook] lookup after migration failure also failed', canonicalError);
      } else if (canonicalRow) {
        existing = pickPreferredExisting([existing, canonicalRow], checkoutIdCandidates) ?? canonicalRow;
      }
    } else {
      existing.checkout_id = checkoutId;
    }
  }

  const name = nameFromPayload ?? existing?.customer_name ?? 'Cliente';
  const productTitle =
    productTitleFromPayload ?? existing?.product_title ?? 'Carrinho (Kiwify)';
  const productId = productIdFromPayload ?? existing?.product_id ?? null;
  const checkoutUrl = checkoutUrlFromPayload ?? existing?.checkout_url ?? null;
  const trafficSource =
    extractTrafficSource(
      body,
      checkoutUrlFromPayload ?? existing?.checkout_url ?? null,
      existing?.traffic_source ?? null,
    ) ?? existing?.traffic_source ?? 'unknown';
  const discountCode =
    discountCodeFromPayload ??
    existing?.discount_code ??
    (process.env.DEFAULT_DISCOUNT_CODE ?? null);

  const scheduleAt =
    existing?.schedule_at ??
    new Date(now.getTime() + DEFAULT_DELAY_HOURS * 3600 * 1000).toISOString();

  const paymentMeta = extractPaymentMeta(body);
  const previouslyPaid = existing?.paid ?? false;
  const paid = paymentMeta.paid || previouslyPaid;
  const becamePaidNow = paymentMeta.paid && !previouslyPaid;
  const paidAt = paid
    ? paymentMeta.paidAt ??
      existing?.paid_at ??
      (becamePaidNow ? now.toISOString() : null)
    : null;

  const baseStatus =
    existing?.status && existing.status !== 'converted'
      ? existing.status
      : 'pending';
  const status = paid ? 'converted' : baseStatus;

  const lastEvent =
    paymentMeta.eventName ?? paymentMeta.statusHint ?? existing?.last_event ?? null;

  console.log('[kiwify-webhook] parsed', {
    email,
    name,
    productTitle,
    productId,
    checkoutUrl,
    discountCode: discountCode ?? null,
    trafficSource,
    paid,
    paidAt,
    status,
    lastEvent,
  });

  let source: string;
  if (existing) {
    source = existing.source ?? 'kiwify.webhook';
  } else if (paid) {
    source = 'kiwify.webhook_purchase';
  } else {
    source = 'kiwify.webhook';
  }

  const row = {
    id: existing?.id ?? crypto.randomUUID(),
    email,
    product_id: productId,
    product_title: productTitle,
    checkout_url: checkoutUrl,
    checkout_id: checkoutId,
    created_at: existing?.created_at ?? now.toISOString(),
    paid,
    paid_at: paidAt,
    payload: body,
    customer_email: email,
    customer_name: name,
    status,
    discount_code: discountCode,
    schedule_at: scheduleAt,
    source,
    traffic_source: trafficSource,
    updated_at: now.toISOString(),
    last_event: lastEvent,
  };

  const { error } = await supabase
    .from('abandoned_emails')
    .upsert(row, { onConflict: 'checkout_id' });

  if (error) {
    console.error('[kiwify-webhook] upsert error', error, {
      rowPreview: { email: row.email, checkout_id: row.checkout_id },
    });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
