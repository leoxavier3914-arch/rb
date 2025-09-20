// app/api/kiwify/webhook/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ⚙️ envs necessárias
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEFAULT_EXPIRE_HOURS = Number((process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()) || 24;

// (opcional) se a Kiwify expõe um secret pra assinar webhooks, ponha aqui
const KIWIFY_WEBHOOK_SECRET = (process.env.KIWIFY_WEBHOOK_SECRET ?? '').trim();

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
    const val = p.split('.').reduce((acc: any, k) => (acc ? acc[k] : undefined), payload);
    if (typeof val === 'string' && /\S+@\S+\.\S+/.test(val)) return val;
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
    const val = p.split('.').reduce((acc: any, k) => (acc ? acc[k] : undefined), payload);
    if (typeof val === 'string' && val.trim()) return val.trim();
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
    const val = p.split('.').reduce((acc: any, k) => (acc ? acc[k] : undefined), payload);
    if (typeof val === 'string' && val.trim()) return val.trim();
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
    const val = p.split('.').reduce((acc: any, k) => (acc ? acc[k] : undefined), payload);
    if (typeof val === 'string' && val.startsWith('http')) return val;
  }
  return null;
}

function safeGetDiscountCode(payload: any): string | null {
  const tryPaths = ['discount_code', 'coupon', 'coupon_code', 'data.coupon'];
  for (const p of tryPaths) {
    const val = p.split('.').reduce((acc: any, k) => (acc ? acc[k] : undefined), payload);
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

function safeGetCheckoutId(payload: any): string {
  const tryPaths = [
    'checkout_id', 'purchase_id', 'order_id', 'cart_id', 'id', 'data.id'
  ];
  for (const p of tryPaths) {
    const val = p.split('.').reduce((acc: any, k) => (acc ? acc[k] : undefined), payload);
    if (val) return String(val);
  }
  return crypto.randomUUID();
}

export async function POST(req: Request) {
  // (opcional) verificação de assinatura — adapte se a Kiwify fornecer um header específico
  if (KIWIFY_WEBHOOK_SECRET) {
    const sig = req.headers.get('x-signature') || '';
    // TODO: verifique hash HMAC(sig, body) se a Kiwify disponibilizar. Mantido como opcional.
    if (!sig) {
      return NextResponse.json({ ok: false, error: 'missing_signature' }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({} as any));

  const email = safeGetEmail(body);
  if (!email) {
    return NextResponse.json({ ok: false, error: 'missing_email' }, { status: 400 });
  }

  const name = safeGetName(body) ?? 'Cliente';
  const productTitle = safeGetProductName(body) ?? 'Produto';
  const checkoutUrl = safeGetCheckoutUrl(body) ?? null;
  const discountCode = safeGetDiscountCode(body) ?? (process.env.DEFAULT_DISCOUNT_CODE ?? null);

  const now = new Date();
  const scheduleAt = new Date(now.getTime() + DEFAULT_EXPIRE_HOURS * 3600 * 1000).toISOString();

  const checkoutId = safeGetCheckoutId(body);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Upsert por checkout_id para idempotência
  const row = {
    id: crypto.randomUUID(),
    email,
    product_title: productTitle,
    checkout_url: checkoutUrl,
    checkout_id: checkoutId,          // UNIQUE recomendado
    created_at: now.toISOString(),
    paid: false,
    paid_at: null as any,
    payload: body,                    // mantém o raw do webhook
    customer_email: email,
    customer_name: name,
    status: 'pending' as const,       // cron vai enviar depois
    discount_code: discountCode,
    schedule_at: scheduleAt,
    source: 'kiwify.webhook',
    updated_at: now.toISOString(),
    // sent_at: null
  };

  const { error } = await supabase
    .from('abandoned_emails')
    .upsert(row, { onConflict: 'checkout_id' });

  if (error) {
    console.error('[kiwify-webhook] upsert error', error, { row });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
