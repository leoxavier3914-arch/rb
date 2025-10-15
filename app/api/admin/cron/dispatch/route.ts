// app/api/admin/cron/dispatch/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { applyDiscountToCheckoutUrl } from '../../../../../lib/checkout';
import { resolveDiscountCode } from '../../../../../lib/cryptoId';
import { readEnvValue } from '../../../../../lib/env';
import {
  EmailJsApiError,
  getEmailJsConfig,
  sendEmailJsTemplate,
} from '../../../../../lib/emailJsConfig';

const DEFAULT_DELAY_HOURS =
  Number(
    (process.env.DEFAULT_DELAY_HOURS ?? process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()
  ) || 24;
const EXPIRE_HOURS   = Number((process.env.DEFAULT_EXPIRE_HOURS ?? '24').trim()) || 24;

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
    !emailPublicKey ||
    !emailPrivateKey
  ) {
    const missingEnv: string[] = [];
    if (!supabaseUrl) missingEnv.push('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceRoleKey)
      missingEnv.push('SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE');
    if (!emailServiceId) missingEnv.push('EMAILJS_SERVICE_ID/NEXT_PUBLIC_EMAILJS_SERVICE_ID');
    if (!emailTemplateId) missingEnv.push('EMAILJS_TEMPLATE_ID/NEXT_PUBLIC_EMAILJS_TEMPLATE_ID');
    if (!emailPublicKey) missingEnv.push('EMAILJS_PUBLIC_KEY/NEXT_PUBLIC_EMAILJS_PUBLIC_KEY');
    if (!emailPrivateKey) missingEnv.push('EMAILJS_PRIVATE_KEY');

    console.error('[cron/dispatch] missing environment variables', missingEnv);
    return NextResponse.json(
      { ok: false, error: 'configuration_error', missing: missingEnv },
      { status: 500 },
    );
  }

  let emailConfig: ReturnType<typeof getEmailJsConfig>;
  try {
    emailConfig = getEmailJsConfig();
  } catch (error) {
    console.error('[cron/dispatch] invalid EmailJS configuration', error);
    return NextResponse.json(
      { ok: false, error: 'configuration_error', missing: (error as Error).message },
      { status: 500 },
    );
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

  let automaticEmailEnabled = true;
  try {
    const { data: settingsRow, error: settingsError } = await supabase
      .from('email_integration_settings')
      .select('automatic_email_enabled')
      .eq('id', 'default')
      .maybeSingle();

    if (settingsError) {
      console.warn('[cron/dispatch] falha ao consultar configuração de envio automático', settingsError);
    } else if (settingsRow && settingsRow.automatic_email_enabled === false) {
      automaticEmailEnabled = false;
    }
  } catch (error) {
    console.warn('[cron/dispatch] erro inesperado ao verificar configuração automática', error);
  }

  if (!automaticEmailEnabled) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 'automatic_email_disabled' });
  }

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
      .in('status', ['pending', 'new'])
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
        await sendEmailJsTemplate({
          serviceId: emailConfig.serviceId,
          templateId: emailConfig.templateId,
          publicKey: emailConfig.publicKey,
          accessToken: emailConfig.privateKey,
          templateParams: {
            to_email: r.email,
            title: 'Finalize sua compra • Romeike Beauty',
            name: r.customer_name ?? 'Cliente',
            product_name: r.product_title,
            product_title: r.product_title,
            discount_code: discountCode,
            expire_hours: String(EXPIRE_HOURS),
            checkout_url: applyDiscountToCheckoutUrl(r.checkout_url, discountCode),
            email: r.email,
          },
        });

        // marca como enviado
        const { error: upErr } = await supabase
          .from('abandoned_emails')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', r.id);

        if (upErr) throw upErr;

        sent++;
      } catch (err) {
        if (err instanceof EmailJsApiError) {
          console.error('[cron/dispatch] send error for id', r.id, err.status, err.body);
        } else {
          console.error('[cron/dispatch] send error for id', r.id, err);
        }
        // opcional: marcar como 'failed' ou re-tentar depois
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
