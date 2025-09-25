// app/api/admin/cron/dispatch/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as emailjs from '@emailjs/nodejs';
import { applyDiscountToCheckoutUrl } from '../../../../../lib/checkout';
import { resolveDiscountCode } from '../../../../../lib/cryptoId';
import { readEnvValue } from '../../../../../lib/env';

const DEFAULT_DELAY_HOURS =
  Number(
    (process.env.DEFAULT_DELAY_HOURS ?? process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()
  ) || 24;
const EXPIRE_HOURS   = Number((process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()) || 24;

let emailJsInitialized = false;

export async function POST(req: Request) {
  const adminToken = readEnvValue('ADMIN_TOKEN');
  const supabaseUrl = readEnvValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceRoleKey = readEnvValue(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_SECRET_KEY',
  );
  const emailServiceId = readEnvValue('EMAILJS_SERVICE_ID', 'NEXT_PUBLIC_EMAILJS_SERVICE_ID');
  const emailTemplateId = readEnvValue('EMAILJS_TEMPLATE_ID', 'NEXT_PUBLIC_EMAILJS_TEMPLATE_ID');
  const emailPublicKey = readEnvValue('EMAILJS_PUBLIC_KEY', 'NEXT_PUBLIC_EMAILJS_PUBLIC_KEY');
  const emailPrivateKey = readEnvValue('EMAILJS_PRIVATE_KEY');

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey ||
    !emailServiceId ||
    !emailTemplateId ||
    !emailPublicKey
  ) {
    const missingEnv: string[] = [];
    if (!supabaseUrl) missingEnv.push('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceRoleKey)
      missingEnv.push('SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE');
    if (!emailServiceId) missingEnv.push('EMAILJS_SERVICE_ID/NEXT_PUBLIC_EMAILJS_SERVICE_ID');
    if (!emailTemplateId) missingEnv.push('EMAILJS_TEMPLATE_ID/NEXT_PUBLIC_EMAILJS_TEMPLATE_ID');
    if (!emailPublicKey) missingEnv.push('EMAILJS_PUBLIC_KEY/NEXT_PUBLIC_EMAILJS_PUBLIC_KEY');

    console.error('[cron/dispatch] missing environment variables', missingEnv);
    return NextResponse.json(
      { ok: false, error: 'configuration_error', missing: missingEnv },
      { status: 500 },
    );
  }

  if (!emailJsInitialized) {
    emailjs.init(
      emailPrivateKey
        ? { publicKey: emailPublicKey, privateKey: emailPrivateKey }
        : { publicKey: emailPublicKey }
    );
    emailJsInitialized = true;
  }

  // proteção simples por token
  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (adminToken && token !== adminToken) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  // busca pendentes “vencidos” em lotes até não restarem registros elegíveis
  const now = new Date();
  const nowIso = now.toISOString();
  const legacyThreshold = new Date(
    now.getTime() - DEFAULT_DELAY_HOURS * 3600 * 1000
  ).toISOString();

  const processedIds = new Set<string>();
  let sent = 0;

  const selectColumns =
    'id,email,customer_name,product_title,checkout_url,discount_code,schedule_at,created_at';
  const BATCH_SIZE = 100;

  while (true) {
    const { data: rows, error } = await supabase
      .from('abandoned_emails')
      .select(selectColumns)
      .eq('status', 'pending')
      .or(
        `schedule_at.lte.${nowIso},and(schedule_at.is.null,created_at.lte.${legacyThreshold})`
      )
      .order('schedule_at', { ascending: true, nullsFirst: true })
      .range(0, BATCH_SIZE - 1);

    if (error) {
      console.error('[cron/dispatch] select error', error);
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    const pendingRows = (rows ?? []).filter((row) => {
      if (!row || processedIds.has(row.id)) return false;
      processedIds.add(row.id);
      return true;
    });

    if (pendingRows.length === 0) {
      break;
    }

    for (const r of pendingRows) {
      try {
        const discountCode = resolveDiscountCode(r.discount_code);
        await emailjs.send(
          emailServiceId,
          emailTemplateId,
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
  }

  return NextResponse.json({ ok: true, sent });
}
