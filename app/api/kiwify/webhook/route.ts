// app/api/kiwify/webhook/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ==== ENVS OBRIGATÓRIAS ====
const SUPABASE_URL =
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
}
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  let found: any = null;
  deepWalk(obj, (k, v) => {
    if (
      keys.some((key) => k.toLowerCase() === key) &&
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

function findCheckoutIdDeep(obj: any): string {
  const byKey = pickByKeys(
    obj,
    ['checkout_id', 'purchase_id', 'order_id', 'cart_id', 'id', 'order_ref'],
    (v) => v !== null && v !== undefined
  );
  return byKey != null ? String(byKey) : crypto.randomUUID();
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
    // Prefer explicit boolean flag when conflicting keywords appear
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
  const checkoutUrlFromPayload = findCheckoutUrlDeep(body);
  const discountCodeFromPayload = findDiscountDeep(body);
  const checkoutId   = findCheckoutIdDeep(body);

  const now = new Date();

  // 4) Upsert no Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: existing, error: fetchError } = await supabase
    .from('abandoned_emails')
    .select(
      'id, paid, paid_at, status, created_at, schedule_at, last_event, checkout_url, discount_code, source, customer_name, product_title'
    )
    .eq('checkout_id', checkoutId)
    .maybeSingle();

  if (fetchError) {
    console.warn('[kiwify-webhook] failed to load existing record', fetchError);
  }

  const name = nameFromPayload ?? existing?.customer_name ?? 'Cliente';
  const productTitle =
    productTitleFromPayload ?? existing?.product_title ?? 'Carrinho (Kiwify)';
  const checkoutUrl = checkoutUrlFromPayload ?? existing?.checkout_url ?? null;
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
    checkoutUrl,
    discountCode: discountCode ?? null,
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
