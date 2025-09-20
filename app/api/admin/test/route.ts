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
  const email = emailFromForm || (process.env.TEST_EMAIL ?? '').trim();

  // validação simples de e-mail
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'email_invalido_ou_ausente' }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date();

  const hours = Number(process.env.DEFAULT_EXPIRE_HOURS ?? '24');
  const scheduleAt = new Date(now.getTime() + hours * 3600 * 1000);

  const payload = {
    id,
    event_id: id,
    email, // ✅ NOT NULL — sempre preenchido
    product_title: (body.product_title ?? body.product ?? 'Catálogo Editável - Cílios').toString(),
    checkout_url: (body.checkout_url ?? 'https://pay.kiwify.com.br/SEU_LINK').toString(),
    created_at: now.toISOString(),
    paid: false as const,
    paid_at: null as any,
    customer_email: email, // espelha pra manter consistência
    customer_name: (body.name ?? 'Cliente Teste').toString(),
    status: 'pending' as const,
    discount_code: (body.discount_code ?? process.env.DEFAULT_DISCOUNT_CODE ?? null) as any,
    schedule_at: scheduleAt.toISOString(),
    source: 'manual.test.created',
    sent_at: null as any,
    updated_at: now.toISOString(),
  };

  const { error } = await supabase.from('abandoned_emails').insert(payload);

  if (error) {
    console.error('[kiwify-hub] erro ao registrar teste', error, { payload });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, email, schedule_at: payload.schedule_at });
}
