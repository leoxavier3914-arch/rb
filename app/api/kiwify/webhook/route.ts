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
  const name = findNameDeep(body) ?? 'Cliente';
  const productTitle = findProductNameDeep(body) ?? 'Carrinho (Kiwify)';
  const checkoutUrl  = findCheckoutUrlDeep(body);
  const discountCode = findDiscountDeep(body) ?? (process.env.DEFAULT_DISCOUNT_CODE ?? null);
  const checkoutId   = findCheckoutIdDeep(body);

  const now = new Date();
  const scheduleAt = new Date(
    now.getTime() + DEFAULT_DELAY_HOURS * 3600 * 1000
  ).toISOString();

  console.log('[kiwify-webhook] parsed', {
    email, name, productTitle,
    checkoutUrl, discountCode: discountCode ?? null
  });

  // 4) Upsert no Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const row = {
    id: crypto.randomUUID(),
    email,
    product_title: productTitle,
    checkout_url: checkoutUrl,
    checkout_id: checkoutId,
    created_at: now.toISOString(),
    paid: false,
    paid_at: null as any,
    payload: body,
    customer_email: email,
    customer_name: name,
    status: 'pending' as const,
    discount_code: discountCode,
    schedule_at: scheduleAt,
    source: 'kiwify.webhook',
    updated_at: now.toISOString(),
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
