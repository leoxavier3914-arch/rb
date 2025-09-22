// app/api/admin/cron/dispatch/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as emailjs from '@emailjs/nodejs';
import { applyDiscountToCheckoutUrl } from '../../../../../lib/checkout';
import { resolveDiscountCode } from '../../../../../lib/cryptoId';

const SUPABASE_URL =
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
}
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_TOKEN = (process.env.ADMIN_TOKEN ?? '').trim();

const EMAIL_PUBLIC   = process.env.EMAILJS_PUBLIC_KEY!;
const EMAIL_PRIVATE  = process.env.EMAILJS_PRIVATE_KEY || ''; // se Strict Mode off, pode ficar vazio
const EMAIL_SERVICE  = process.env.EMAILJS_SERVICE_ID!;
const EMAIL_TEMPLATE = process.env.EMAILJS_TEMPLATE_ID!;
const DEFAULT_DELAY_HOURS =
  Number(
    (process.env.DEFAULT_DELAY_HOURS ?? process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()
  ) || 24;
const EXPIRE_HOURS   = Number((process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()) || 24;

// init EmailJS (Strict Mode se tiver PRIVATE)
emailjs.init(EMAIL_PRIVATE ? { publicKey: EMAIL_PUBLIC, privateKey: EMAIL_PRIVATE } : { publicKey: EMAIL_PUBLIC });

export async function POST(req: Request) {
  // proteção simples por token
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (ADMIN_TOKEN && token !== ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // busca até 20 pendentes “vencidos”
  const now = new Date();
  const nowIso = now.toISOString();
  const legacyThreshold = new Date(
    now.getTime() - DEFAULT_DELAY_HOURS * 3600 * 1000
  ).toISOString();

  const { data: rows, error } = await supabase
    .from('abandoned_emails')
    .select(
      'id,email,customer_name,product_title,checkout_url,discount_code,schedule_at,created_at'
    )
    .eq('status', 'pending')
    .or(
      `schedule_at.lte.${nowIso},and(schedule_at.is.null,created_at.lte.${legacyThreshold})`
    )
    .order('schedule_at', { ascending: true, nullsFirst: true })
    .limit(20);

  if (error) {
    console.error('[cron/dispatch] select error', error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  for (const r of rows) {
    try {
      const discountCode = resolveDiscountCode(r.discount_code);
      await emailjs.send(
        EMAIL_SERVICE,
        EMAIL_TEMPLATE,
        {
          to_email: r.email,                            // To Email do template
          title: 'Finalize sua compra • Romeike Beauty',// Subject usa {{title}}
          name: r.customer_name ?? 'Cliente',           // {{name}}
          product_name: r.product_title,                // {{product_name}}
          discount_code: discountCode,                  // {{discount_code}}
          expire_hours: String(EXPIRE_HOURS),           // {{expire_hours}}
          checkout_url: applyDiscountToCheckoutUrl(r.checkout_url, discountCode),
          email: r.email,                               // Reply-To usa {{email}}
        }
      );

      // marca como enviado
      const { error: upErr } = await supabase
        .from('abandoned_emails')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', r.id);

      if (upErr) throw upErr;

      sent++;
    } catch (err) {
      console.error('[cron/dispatch] send error for id', r.id, err);
      // opcional: marcar como 'failed' ou re-tentar depois
    }
  }

  return NextResponse.json({ ok: true, sent });
}
