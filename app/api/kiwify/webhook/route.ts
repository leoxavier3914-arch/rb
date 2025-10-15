// app/api/kiwify/webhook/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { readEnvValue } from '../../../../lib/env';
import { deepWalk, pickByKeys } from './utils';
import {
  extractTrafficSource,
  extractTrackingParams,
  hasUrlTrackingParams,
  mergeCheckoutUrlWithTracking,
} from './traffic';

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

function normalizeEmailForMatch(value: any): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatusForMatch(value: any): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
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

    const isApprovedStatus = (status: string | null | undefined) =>
      status === 'approved' || status === 'converted';
    const currentPaid = Boolean(current.paid) || isApprovedStatus(current.status);
    const candidatePaid = Boolean(candidate.paid) || isApprovedStatus(candidate.status);
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

function shouldKeepExistingCandidate(
  row: any,
  options: {
    normalizedProductIdFromPayload: string | null;
    normalizedProductTitleFromPayload: string | null;
    checkoutIdCandidateSet: Set<string>;
  }
): boolean {
  if (!row) return false;

  const checkoutId =
    typeof row.checkout_id === 'string' ? row.checkout_id.trim() : null;
  if (checkoutId && options.checkoutIdCandidateSet.has(checkoutId)) {
    return true;
  }

  const normalizedRowProductId = normalizeProductComponent(row.product_id);
  const normalizedRowProductTitle = normalizeProductComponent(row.product_title);

  const payloadHasProduct =
    Boolean(options.normalizedProductIdFromPayload) ||
    Boolean(options.normalizedProductTitleFromPayload);
  const rowHasProduct = Boolean(normalizedRowProductId || normalizedRowProductTitle);

  if (!payloadHasProduct) {
    return true;
  }

  if (
    options.normalizedProductIdFromPayload &&
    normalizedRowProductId &&
    normalizedRowProductId !== options.normalizedProductIdFromPayload
  ) {
    return false;
  }

  if (
    options.normalizedProductTitleFromPayload &&
    normalizedRowProductTitle &&
    normalizedRowProductTitle !== options.normalizedProductTitleFromPayload
  ) {
    return false;
  }

  if (payloadHasProduct && !rowHasProduct) {
    return false;
  }

  return true;
}

async function propagateConvertedStatus(args: {
  supabase: SupabaseClient;
  checkoutIdCandidates: Iterable<string>;
  currentRowId: string;
  email: string;
  productId: string | null;
  productTitle: string | null;
  paidAt: string | null;
  lastEvent: string | null;
  nowIso: string;
}) {
  const {
    supabase,
    checkoutIdCandidates,
    currentRowId,
    email,
    productId,
    productTitle,
    paidAt,
    lastEvent,
    nowIso,
  } = args;

  const candidateIdSet = new Set(
    Array.from(checkoutIdCandidates)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
  );
  const candidateIds = Array.from(candidateIdSet);

  type MinimalRow = {
    id: string;
    checkout_id: string | null;
    paid: boolean | null;
    status: string | null;
    paid_at: string | null;
    last_event: string | null;
    product_id: string | null;
    product_title: string | null;
  };

  const seenIds = new Set<string>();
  const collectRows = (rows: MinimalRow[] | null | undefined, buffer: MinimalRow[]) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (!row || typeof row.id !== 'string') continue;
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      buffer.push(row);
    }
  };

  const relatedRows: MinimalRow[] = [];

  if (candidateIds.length) {
    const { data, error } = await supabase
      .from('abandoned_emails')
      .select(
        'id, checkout_id, paid, status, paid_at, last_event, product_id, product_title'
      )
      .in('checkout_id', candidateIds);

    if (error) {
      console.warn('[kiwify-webhook] failed to load duplicates by checkout_id', error, {
        checkoutIdCount: candidateIds.length,
      });
    } else {
      collectRows(data, relatedRows);
    }
  }

  const normalizedEmail = normalizeEmailForMatch(email);
  const emailVariants = new Set<string>();
  if (normalizedEmail) {
    emailVariants.add(normalizedEmail);
  }
  const rawEmail = typeof email === 'string' ? email.trim() : '';
  if (rawEmail && rawEmail !== normalizedEmail) {
    emailVariants.add(rawEmail);
  }

  const emailColumns: Array<'customer_email' | 'email'> = ['customer_email', 'email'];

  const emailVariantList = Array.from(emailVariants);

  for (const variant of emailVariantList) {
    for (const column of emailColumns) {
      const query = supabase
        .from('abandoned_emails')
        .select(
          'id, checkout_id, paid, status, paid_at, last_event, product_id, product_title'
        )
        .eq(column, variant)
        .limit(200);

      const { data, error } = await query;
      if (error) {
        console.warn('[kiwify-webhook] failed to load duplicates by email', error, {
          column,
        });
        continue;
      }
      collectRows(data, relatedRows);
    }
  }

  if (!relatedRows.length) {
    return;
  }

  const targetProductId = normalizeProductComponent(productId);
  const targetProductTitle = normalizeProductComponent(productTitle);

  const updates: MinimalRow[] = [];

  for (const candidate of relatedRows) {
    if (!candidate || candidate.id === currentRowId) continue;

    const candidateProductId = normalizeProductComponent(candidate.product_id);
    const candidateProductTitle = normalizeProductComponent(candidate.product_title);

    const matchesCheckoutId =
      candidate.checkout_id && candidateIdSet.has(candidate.checkout_id);

    let matchesProduct = Boolean(matchesCheckoutId);
    if (!matchesProduct) {
      if (targetProductId && candidateProductId) {
        matchesProduct = candidateProductId === targetProductId;
      } else if (!targetProductId && targetProductTitle && candidateProductTitle) {
        matchesProduct = candidateProductTitle === targetProductTitle;
      }
    }

    if (!matchesProduct) {
      continue;
    }

    const candidateStatus = normalizeStatusForMatch(candidate.status);
    const alreadyApproved = Boolean(candidate.paid) && candidateStatus === 'approved';
    const hasPaidAt = Boolean(candidate.paid_at);

    if (alreadyApproved && hasPaidAt) {
      continue;
    }

    updates.push({
      id: candidate.id,
      checkout_id: candidate.checkout_id ?? null,
      paid: true,
      status: 'approved',
      paid_at: candidate.paid_at ?? paidAt ?? nowIso,
      last_event: candidate.last_event ?? lastEvent ?? null,
      product_id: candidate.product_id ?? null,
      product_title: candidate.product_title ?? null,
    });
  }

  if (!updates.length) {
    return;
  }

  const payload = updates.map((item) => ({
    id: item.id,
    paid: true,
    status: 'approved',
    paid_at: item.paid_at,
    last_event: item.last_event,
    updated_at: nowIso,
  }));

  const { error } = await supabase.from('abandoned_emails').upsert(payload);
  if (error) {
    console.warn('[kiwify-webhook] failed to propagate approved status', error, {
      ids: payload.map((row) => row.id),
    });
  }
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

const TERMINAL_STATUSES = new Set(['approved', 'converted', 'refunded', 'refused']);

function isTerminalStatus(value: string | null | undefined): boolean {
  const normalized = normalizeStatusForMatch(value);
  return normalized ? TERMINAL_STATUSES.has(normalized) : false;
}

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
  const normalizedProductIdFromPayload = normalizeProductComponent(productIdFromPayload);
  const normalizedProductTitleFromPayload = normalizeProductComponent(
    productTitleFromPayload
  );
  const checkoutUrlFromPayload = findCheckoutUrlDeep(body);
  const trackingParamsFromPayload = extractTrackingParams(body);
  const discountCodeFromPayload = findDiscountDeep(body);
  const checkoutIdResolution = findCheckoutIdDeep(body, {
    email,
    productId: productIdFromPayload,
    productTitle: productTitleFromPayload,
  });
  const canonicalCheckoutId = checkoutIdResolution.primary;
  const checkoutIdCandidates = checkoutIdResolution.candidates;
  const checkoutIdCandidateSet = new Set(
    checkoutIdCandidates
      .map((value) => (typeof value === 'string' ? value.trim() : null))
      .filter((value): value is string => Boolean(value))
  );
  let checkoutId = canonicalCheckoutId;

  const now = new Date();

  const supabaseUrl = readEnvValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceRoleKey = readEnvValue(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET_KEY',
  );

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missingEnv: string[] = [];
    if (!supabaseUrl) missingEnv.push('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceRoleKey)
      missingEnv.push('SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE');

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
    'id, checkout_id, paid, paid_at, status, created_at, updated_at, schedule_at, last_event, last_reminder_at, checkout_url, discount_code, source, traffic_source, customer_name, product_title, product_id';

  let existing: any = null;
  let existingOriginalProductId: string | null = null;
  let existingOriginalProductTitle: string | null = null;

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
      existingOriginalProductId = existing?.product_id ?? null;
      existingOriginalProductTitle = existing?.product_title ?? null;
      if (
        existing &&
        !shouldKeepExistingCandidate(existing, {
          normalizedProductIdFromPayload,
          normalizedProductTitleFromPayload,
          checkoutIdCandidateSet,
        })
      ) {
        console.log('[kiwify-webhook] discarding existing candidate due to product mismatch', {
          existingId: existing?.id ?? null,
          existingCheckoutId: existing?.checkout_id ?? null,
          existingProductId: existingOriginalProductId,
          existingProductTitle: existingOriginalProductTitle,
          payloadProductId: productIdFromPayload ?? null,
          payloadProductTitle: productTitleFromPayload ?? null,
        });
        existing = null;
        existingOriginalProductId = null;
        existingOriginalProductTitle = null;
      }
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
      const filteredRows = fallbackRows.filter((row) =>
        shouldKeepExistingCandidate(row, {
          normalizedProductIdFromPayload,
          normalizedProductTitleFromPayload,
          checkoutIdCandidateSet,
        })
      );

      if (filteredRows.length) {
        const picked = pickPreferredExisting(filteredRows, checkoutIdCandidates);
        if (picked) {
          existing = picked;
          existingOriginalProductId = existing?.product_id ?? null;
          existingOriginalProductTitle = existing?.product_title ?? null;
        }
      } else {
        existing = null;
        existingOriginalProductId = null;
        existingOriginalProductTitle = null;
      }
    }
  }

  const normalizedCheckoutId =
    typeof checkoutId === 'string' && checkoutId.trim().length > 0
      ? checkoutId.trim()
      : null;
  const normalizedExistingCheckoutId =
    typeof existing?.checkout_id === 'string' && existing.checkout_id.trim().length > 0
      ? existing.checkout_id.trim()
      : null;
  const checkoutChanged = Boolean(
    existing?.id && normalizedCheckoutId && normalizedCheckoutId !== normalizedExistingCheckoutId
  );

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
        existingOriginalProductId = existing?.product_id ?? null;
        existingOriginalProductTitle = existing?.product_title ?? null;
      }
    } else {
      existing.checkout_id = checkoutId;
    }
  }

  const name = nameFromPayload ?? existing?.customer_name ?? 'Cliente';
  const productTitle =
    productTitleFromPayload ?? existing?.product_title ?? 'Carrinho (Kiwify)';
  const productId = productIdFromPayload ?? existing?.product_id ?? null;
  const checkoutUrl = mergeCheckoutUrlWithTracking(
    checkoutUrlFromPayload ?? existing?.checkout_url ?? null,
    trackingParamsFromPayload,
    existing?.checkout_url ?? null,
  );
  const trafficSource =
    extractTrafficSource(body, checkoutUrl, existing?.traffic_source ?? null) ??
    existing?.traffic_source ??
    'unknown';
  const discountCode =
    discountCodeFromPayload ??
    existing?.discount_code ??
    (process.env.DEFAULT_DISCOUNT_CODE ?? null);

  const defaultScheduleAt = new Date(now.getTime() + DEFAULT_DELAY_HOURS * 3600 * 1000).toISOString();
  const scheduleAt = checkoutChanged
    ? defaultScheduleAt
    : existing?.schedule_at ?? defaultScheduleAt;

  const paymentMeta = extractPaymentMeta(body);
  const previouslyPaid = existing?.paid ?? false;
  const paid = paymentMeta.paid || previouslyPaid;
  const becamePaidNow = paymentMeta.paid && !previouslyPaid;
  const paidAt = paid
    ? paymentMeta.paidAt ??
      existing?.paid_at ??
      (becamePaidNow ? now.toISOString() : null)
    : null;

  const existingStatus =
    typeof existing?.status === 'string' && existing.status.trim().length > 0
      ? existing.status
      : null;
  const isTerminalExistingStatus = isTerminalStatus(existingStatus);
  const isSameCheckout = Boolean(
    typeof existing?.checkout_id === 'string' &&
      typeof checkoutId === 'string' &&
      existing.checkout_id === checkoutId,
  );
  const shouldKeepExistingStatus = checkoutChanged
    ? false
    : Boolean(isSameCheckout && existingStatus && isTerminalExistingStatus);
  const baseStatus = shouldKeepExistingStatus ? existingStatus : 'new';
  const status = paid ? 'approved' : baseStatus;

  const lastReminderAt = checkoutChanged ? null : existing?.last_reminder_at ?? null;
  const lastEvent = checkoutChanged
    ? null
    : paymentMeta.eventName ?? paymentMeta.statusHint ?? existing?.last_event ?? null;

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

  const nowIso = now.toISOString();

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
    updated_at: nowIso,
    last_event: lastEvent,
    last_reminder_at: lastReminderAt,
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

  if (paid) {
    await propagateConvertedStatus({
      supabase,
      checkoutIdCandidates,
      currentRowId: row.id,
      email,
      productId,
      productTitle,
      paidAt: row.paid_at ?? null,
      lastEvent,
      nowIso,
    });
  }

  return NextResponse.json({ ok: true });
}
