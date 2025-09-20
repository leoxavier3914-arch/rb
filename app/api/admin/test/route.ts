// app/api/admin/test/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  // Supabase admin (Service Role)
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // (opcional) proteção por token admin
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (expected) {
    const header = req.headers.get('authorization') || '';
    const token = header.replace(/^Bearer\s+/i, '');
    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => ({} as any));

  // Aceita email vindo como "email" ou "customer_email"; usa TEST_EMAIL como fallback
  const emailFromForm = (body.email ?? body.customer_email ?? '').toString().trim();
  const email =
    emailFromForm ||
    (process.env.TEST_EMAIL ?? '').trim();

  // validação simples de e-mail
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'email_invalido_ou_ausente' }, { status: 400 });
  }

  console.log('[admin/test] email resolvido =', email, 'bodyKeys =', Object.keys(body || {}));

  const id = randomUUID();
  const now = new Date();

  const hours = Number(process.env.DEFAULT_EXPIRE_HOURS ?? '24');
  const scheduleAt = new Date(now.getTime() + hours * 3600 * 1000);

  // Deriva checkoutId (usa o do body se vier; senão usamos o próprio id do teste)
  const checkoutId = (
    body.checkout_id ??
    body.purchase_id ??
    body.order_id ??
    body.id ??
    id
  ).toString();

  const rawPayload =
    body && typeof body === 'object' ? body : { note: 'manual.test', raw: String(body ?? '') };

  const row = {
    id,
    event_id: id,
    email: email,
    product_title: (body.product_title ?? body.product ?? 'Catálogo Editável - Cílios').toString(),
    checkout_url: (body.checkout_url ?? 'https://pay.kiwify.com.br/SEU_LINK').toString(),
    checkout_id: checkoutId,
    created_at: now.toISOString(),
    paid: false as const,
    paid_at: null as any,
    customer_email: email,
    customer_name: (body.name ?? 'Cliente Teste').toString(),
    status: 'pending' as const,
    discount_code: (body.discount_code ?? process.env.DEFAULT_DISCOUNT_CODE ?? null) as any,
    schedule_at: scheduleAt.toISOString(),
    source: 'manual.test.created',
    sent_at: null as any,
    updated_at: now.toISOString(),
    payload: rawPayload,
  };

  if (!row.email) {
    console.error('[admin/test] row.email ausente!', row);
    return NextResponse.json({ ok: false, error: 'email_vazio_no_payload' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('abandoned_emails')
    .insert(row)
    .select('id,email,customer_email')
    .single();

  if (error) {
    console.error('[kiwify-hub] erro ao registrar teste', error, { row });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, email: data.email, schedule_at: row.schedule_at });
}
