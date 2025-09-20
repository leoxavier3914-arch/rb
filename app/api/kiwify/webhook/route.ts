// app/api/kiwify/webhook/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ---- Envs
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_EXPIRE_HOURS =
  Number((process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()) || 24;

const KIWIFY_WEBHOOK_SECRET = (process.env.KIWIFY_WEBHOOK_SECRET ?? '').trim();
// Se quiser bloquear em caso de assinatura inválida, ligue esta env com "true"
const STRICT_SIGNATURE =
  (process.env.KIWIFY_STRICT_SIGNATURE ?? 'false').toLowerCase() === 'true';

// ---- Utils (extração resiliente)
function safeGetEmail(payload: any): string | null {
  const tryPaths = [
    'email',
    'customer_email',
    'buyer.email',
    'customer.email',
    'user.email',
    'data.email',
  ];
  for (const p of tryPaths) {
    const v = p.split('.').reduce((a: any, k) => (a ? a[k] : undefined), payload);
    if (typeof v === 'string' && /\S+@\S+\.\S+/.test(v)) return v;
  }
  return null;
}

function safeGetName(payload: any): string | null {
  const tryPaths = [
    'name',
    'customer_name',
    'buyer.name',
    'customer.name',
    'user.name',
    'data.name',
  ];
  for (const p of tryPaths) {
    const v = p.split('.').reduce((a: any, k) => (a ? a[k] : undefined), payload);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function safeGetProductName(payload: any): string | null {
  const tryPaths = [
    'product_name',
    'product.title',
    'item.title',
    'items.0.title',
    'data.product_name',
  ];
  for (const p of tryPaths) {
    const v = p.split('.').reduce((a: any, k) => (a ? a[k] : undefined), payload);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function safeGetCheckoutUrl(payload: any): string | null {
  const tryPaths = [
    'checkout_url',
    'payment_link',
    'url',
    'links.checkout',
    'item.checkout_url',
    'items.0.checkout_url',
  ];
  for (const p of tryPaths) {
    const v = p.split('.').reduce((a: any, k) => (a ? a[k] : undefined), payload);
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  return null;
}

function safeGetDiscountCode(payload: any): string | null {
  const tryPaths = ['discount_code', 'coupon', 'coupon_code', 'data.coupon'];
  for (const p of tryPaths) {
    const v = p.split('.').reduce((a: any, k) => (a ? a[k] : undefined), payload);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function safeGetCheckoutId(payload: any): string {
  const tryPaths = [
    'checkout_id',
    'purchase_id',
    'order_id',
    'cart_id',
    'id',
    'data.id',
  ];
  for (const p of tryPaths) {
    const v = p.split('.').reduce((a: any, k) => (a ? a[k] : undefined), payload);
    if (v !== undefined && v !== null) return String(v);
  }
  return crypto.randomUUID();
}

// ---- Assinatura
function normalizeSig(sig: string) {
  return sig.startsWith('sha256=') ? sig.slice(7) : sig;
}
function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  try {
    return crypto.timingSafeEqual(A, B);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const ct = (req.headers.get('content-type') || '').toLowerCase();

  // 1) Lê RAW e parseia body (JSON ou form)
  const raw = await req.text();
  let body: any = {};
  try {
    if (ct.includes('application/json')) {
      body = raw ? JSON.parse(raw) : {};
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      body = Object.fromEntries(new URLSearchParams(raw));
    } else {
      // tenta JSON; se não, guarda bruto
      body = raw ? JSON.parse(raw) : {};
    }
  } catch {
    body = { raw };
  }

  // Log leve (ajuda no debug sem vazar conteúdo)
  try {
    const sampleHeaders = Object.fromEntries(
      Array.from(req.headers.entries())
        .filter(([k]) => /^x-|content-|user-agent|accept/i.test(k))
        .slice(0, 12)
    );
    console.log('[kiwify-webhook] hit', { ct, hasBody: !!raw, sampleHeaders });
  } catch {}

  // 2) Verifica assinatura (se houver SECRET)
  if (KIWIFY_WEBHOOK_SECRET) {
    const providedRaw =
      req.headers.get('x-kiwify-signature') ||
      req.headers.get('x-signature') ||
      url.searchParams.get('signature') ||
      '';
    if (!providedRaw) {
      console.warn('[kiwify-webhook] missing signature');
      return NextResponse.json(
        { ok: false, error: 'missing_signature' },
        { status: 401 }
      );
    }

    // Calcula HMAC em hex e base64 e aceita qualquer um dos formatos
    const hmac = crypto.createHmac('sha256', KIWIFY_WEBHOOK_SECRET).update(raw, 'utf8');
    const expectedHex = hmac.digest('hex');
    // se precisar comparar também base64:
    const expectedB64 = Buffer.from(expectedHex, 'hex').toString('base64');

    const provided = normalizeSig(providedRaw);

    const ok =
      safeEq(provided, expectedHex) ||
      safeEq(provided, expectedB64);

    if (!ok) {
      const msg = '[kiwify-webhook] signature mismatch';
      if (STRICT_SIGNATURE) {
        console.warn(msg + ' (blocking)');
        return NextResponse.json(
          { ok: false, error: 'invalid_signature' },
          { status: 401 }
        );
      } else {
        console.warn(msg + ' (continuing; STRICT_SIGNATURE=false)');
      }
    }
  }

  // 3) Extrai campos
  const email = safeGetEmail(body);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: 'missing_email' },
      { status: 400 }
    );
  }
  const name = safeGetName(body) ?? 'Cliente';
  const productTitle = safeGetProductName(body) ?? 'Produto';
  const checkoutUrl = safeGetCheckoutUrl(body) ?? null;
  const discountCode =
    safeGetDiscountCode(body) ?? (process.env.DEFAULT_DISCOUNT_CODE ?? null);

  const now = new Date();
  const scheduleAt = new Date(
    now.getTime() + DEFAULT_EXPIRE_HOURS * 3600 * 1000
  ).toISOString();

  const checkoutId = safeGetCheckoutId(body);

  // 4) Insere/atualiza no Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const row = {
    id: crypto.randomUUID(),
    email,
    product_title: productTitle,
    checkout_url: checkoutUrl,
    checkout_id: checkoutId, // de preferência UNIQUE
    created_at: now.toISOString(),
    paid: false,
    paid_at: null as any,
    payload: body, // guarda o raw para auditoria
    customer_email: email,
    customer_name: name,
    status: 'pending' as const,
    discount_code: discountCode,
    schedule_at: scheduleAt,
    source: 'kiwify.webhook',
    updated_at: now.toISOString(),
    // sent_at: null (pendente)
  };

  const { error } = await supabase
    .from('abandoned_emails')
    .upsert(row, { onConflict: 'checkout_id' });

  if (error) {
    console.error('[kiwify-webhook] upsert error', error, { rowPreview: { email: row.email, checkout_id: row.checkout_id } });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
