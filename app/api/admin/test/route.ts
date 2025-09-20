// app/api/admin/test/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

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

  const emailFromForm = (body.email ?? body.customer_email ?? '').toString().trim();
  const email = emailFromForm || (process.env.TEST_EMAIL ?? '').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.warn('[admin/test] email inválido/ausente. bodyKeys=', Object.keys(body || {}));
    return NextResponse.json({ ok: false, error: 'email_invalido_ou_ausente' }, { status: 400 });
  }

  const rawHours = (process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim();
  let hours = Number(rawHours);
  if (!Number.isFinite(hours) || hours <= 0) hours = 24;

  const now = new Date();
  const scheduleAtISO = new Date(now.getTime() + hours * 3600 * 1000).toISOString();

  console.log('[admin/test] hours=', hours, 'scheduleAt=', scheduleAtISO);

  const checkoutId = (
    body.checkout_id ??
    body.purchase_id ??
    body.order_id ??
    body.id ??
    crypto.randomUUID()
  ).toString();

  const rawPayload =
    body && typeof body === 'object' ? body : { note: 'manual.test', raw: String(body ?? '') };

  const row = {
    id: crypto.randomUUID(),
    event_id: undefined as any, // MANTENHA ou REMOVA; se sua tabela tem event_id, troque para: event_id: this.id
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
  };

  if (!row.email) {
    console.error('[admin/test] row.email ausente!', row);
    return NextResponse.json({ ok: false, error: 'email_vazio_no_payload' }, { status: 500 });
  }
  if (!row.schedule_at) {
    console.error('[admin/test] row.schedule_at ausente!', row);
    return NextResponse.json({ ok: false, error: 'schedule_at_missing' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('abandoned_emails')
    .insert(row)
    .select('id,email,customer_email,schedule_at')
    .single();

  if (error) {
    console.error('[kiwify-hub] erro ao registrar teste', error, { row });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, email: data.email, schedule_at: data.schedule_at });
}
