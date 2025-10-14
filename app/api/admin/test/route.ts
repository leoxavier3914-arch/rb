// app/api/admin/test/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { applyDiscountToCheckoutUrl } from '../../../../lib/checkout';
import {
  EmailJsApiError,
  getEmailJsConfig,
  sendEmailJsTemplate,
} from '../../../../lib/emailJsConfig';
import { readEnvValue } from '../../../../lib/env';

export async function POST(req: Request) {
  // --- Env guards úteis (erros mais claros) ---
  const supabaseUrl = readEnvValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') ?? '';
  const supabaseKey =
    readEnvValue(
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_SECRET_KEY',
    ) ?? '';
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[env] faltam SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE',
    );
    return NextResponse.json({ ok: false, error: 'env_missing_supabase' }, { status: 500 });
  }

  // Supabase admin (Service Role)
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // (opcional) proteção por token admin
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (expected) {
    const header = req.headers.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  // Body seguro
  const body = await req.json().catch(() => ({} as any));

  // Resolve e valida o e-mail
  const emailFromForm = (body.email ?? body.customer_email ?? '').toString().trim();
  const email =
    emailFromForm ||
    (process.env.TEST_EMAIL ?? '').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.warn('[admin/test] email inválido/ausente. bodyKeys=', Object.keys(body || {}));
    return NextResponse.json({ ok: false, error: 'email_invalido_ou_ausente' }, { status: 400 });
  }

  // Calcula schedule_at robusto
  const rawDelay = (
    process.env.DEFAULT_DELAY_HOURS ??
    process.env.DEFAULT_EXPIRE_HOURS ??
    '24'
  ).trim();
  let delayHours = Number(rawDelay);
  if (!Number.isFinite(delayHours) || delayHours <= 0) delayHours = 24;

  const now = new Date();
  const scheduleAtISO = new Date(now.getTime() + delayHours * 3600 * 1000).toISOString();
  console.log('[admin/test] delayHours=', delayHours, 'scheduleAt=', scheduleAtISO);

  // checkout_id com fallbacks
  const checkoutId = (
    body.checkout_id ??
    body.purchase_id ??
    body.order_id ??
    body.id ??
    crypto.randomUUID()
  ).toString();

  // payload json
  const rawPayload =
    body && typeof body === 'object' ? body : { note: 'manual.test', raw: String(body ?? '') };

  // Monta a linha para inserir (ajuste os campos ao seu schema atual)
  const row = {
    id: crypto.randomUUID(),
    // Se sua tabela tiver event_id e você quiser usar, ative a linha abaixo:
    // event_id: crypto.randomUUID(),
    email: email,
    product_title: (body.product_title ?? body.product ?? 'Catálogo Editável - Cílios').toString(),
    checkout_url: (body.checkout_url ?? 'https://pay.kiwify.com.br/SEU_LINK').toString(),
    checkout_id: checkoutId,
    created_at: now.toISOString(),
    paid: false as const,
    paid_at: null as any,
    payload: rawPayload,
    customer_email: email,
    customer_name: (body.name ?? 'Cliente Teste').toString(),
    status: 'pending' as const,
    discount_code: (body.discount_code ?? process.env.DEFAULT_DISCOUNT_CODE ?? null) as any,
    schedule_at: scheduleAtISO,
    source: 'manual.test.created',
    updated_at: now.toISOString(),
    // sent_at: null  // se a coluna for NOT NULL, não deixe null; ideal é permitir NULL para "pending"
  };

  // Garantias finais antes do insert
  if (!row.email) {
    console.error('[admin/test] row.email ausente!', row);
    return NextResponse.json({ ok: false, error: 'email_vazio_no_payload' }, { status: 500 });
  }
  if (!row.schedule_at) {
    console.error('[admin/test] row.schedule_at ausente!', row);
    return NextResponse.json({ ok: false, error: 'schedule_at_missing' }, { status: 500 });
  }

  // INSERT
  const { data, error } = await supabase
    .from('abandoned_emails')
    .insert(row)
    .select('id,email,customer_name,product_title,checkout_url,schedule_at')
    .single();

  if (error) {
    console.error('[kiwify-hub] erro ao registrar teste', error, { row });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  // Envio do e-mail de teste via EmailJS
  try {
    const { serviceId, templateId, publicKey } = getEmailJsConfig();
    const checkoutWithDiscount = applyDiscountToCheckoutUrl(row.checkout_url, row.discount_code as any);

    await sendEmailJsTemplate({
      serviceId,
      templateId,
      publicKey,
      templateParams: {
        to_email: data.email,
        name: data.customer_name ?? 'Cliente',
        product_name: data.product_title,
        product_title: data.product_title,
        checkout_url: checkoutWithDiscount,
        schedule_at: new Date(data.schedule_at).toLocaleString('pt-BR'),
      },
    });
  } catch (err) {
    if (err instanceof EmailJsApiError) {
      console.error('[kiwify-hub] erro ao enviar teste via EmailJS', err.status, err.body);
    } else {
      console.error('[kiwify-hub] erro ao enviar teste via EmailJS', err);
    }
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    email: data.email,
    schedule_at: data.schedule_at,
  });
}
