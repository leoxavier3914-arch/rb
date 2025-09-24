import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveDiscountCode, resolveExpiration } from '../../../../lib/cryptoId';
import { getEmailJsConfig } from '../../../../lib/emailJsConfig';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import {
  applyDiscountToCheckoutUrl,
  applyManualTrackingToCheckoutUrl,
} from '../../../../lib/checkout';

const resendSchema = z.object({
  id: z.string(),
  email: z.string().email().optional().nullable(),
  name: z.string().optional().nullable(),
  checkoutUrl: z.string().url().optional().nullable(),
  discountCode: z.string().optional().nullable(),
  expiresInHours: z.union([z.number(), z.string()]).optional().nullable(),
});

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export async function POST(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  const header = request.headers.get('authorization');
  const cookieToken = request.cookies.get('admin_token')?.value;

  const isAuthorized = header === `Bearer ${adminToken}` || cookieToken === adminToken;

  if (!adminToken || !isAuthorized) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 });
  }

  const { id, email, name, checkoutUrl, discountCode, expiresInHours } = parsed.data;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error('[kiwify-hub] configuração do Supabase ausente', error);
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 500 });
  }

  const { data: record, error: fetchError } = await supabase
    .from('abandoned_emails')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
  }

  const resolvedDiscount = resolveDiscountCode(discountCode ?? record.discount_code ?? null);
  const expiresIn = typeof expiresInHours === 'string' ? Number.parseInt(expiresInHours, 10) : expiresInHours ?? undefined;
  const expiresAt = resolvedDiscount ? resolveExpiration(expiresIn) : record.expires_at ?? null;

  let serviceId: string;
  let templateId: string;
  let publicKey: string;
  try {
    ({ serviceId, templateId, publicKey } = getEmailJsConfig());
  } catch (error) {
    console.error('[kiwify-hub] configuração do EmailJS ausente', error);
    return NextResponse.json({ error: 'Serviço de e-mail indisponível.' }, { status: 500 });
  }

  const resolvedCheckoutUrl = applyManualTrackingToCheckoutUrl(
    applyDiscountToCheckoutUrl(checkoutUrl ?? record.checkout_url ?? '', resolvedDiscount),
    {
      trafficSource: record.traffic_source ?? null,
    },
  );

  const normalizeString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const extractProduct = (source: Record<string, unknown> | null | undefined): string | null => {
    if (!source) return null;
    const candidates = [
      'product_name',
      'offer_name',
      'product_title',
      'item_title',
      'course_name',
      'plan_name',
    ] as const;

    for (const key of candidates) {
      const value = normalizeString(source[key]);
      if (value) return value;
    }

    return null;
  };

  const rawPayload = record.payload;
  let payloadProduct: string | null = null;
  if (rawPayload && typeof rawPayload === 'object') {
    payloadProduct = extractProduct(rawPayload as Record<string, unknown>);
  } else if (typeof rawPayload === 'string' && rawPayload.trim()) {
    try {
      const parsed = JSON.parse(rawPayload);
      if (parsed && typeof parsed === 'object') {
        payloadProduct = extractProduct(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore malformed payload
    }
  }

  const resolvedProductName =
    normalizeString(record.product_name) ??
    normalizeString(record.product_title) ??
    payloadProduct ??
    'Produto Kiwify';

  const templateParams = {
    to_email: email ?? record.customer_email,
    name: name ?? record.customer_name ?? 'Cliente',
    product_name: resolvedProductName,
    checkout_url: resolvedCheckoutUrl,
    discount_code: resolvedDiscount ?? '',
    expires_at: expiresAt,
  };

  let response: Response;
  try {
    response = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: templateParams,
      }),
    });
  } catch (error) {
    console.error('[kiwify-hub] falha ao contatar EmailJS', error);
    return NextResponse.json({ error: 'Falha ao enviar e-mail.' }, { status: 502 });
  }

  if (!response.ok) {
    const message = await response.text();
    console.error('[kiwify-hub] erro ao enviar e-mail', response.status, message);
    return NextResponse.json({ error: 'Falha ao enviar e-mail.' }, { status: 502 });
  }

  const now = new Date().toISOString();
  const nextStatus = record.status === 'converted' ? record.status : 'sent';

  const { error: updateError } = await supabase
    .from('abandoned_emails')
    .update({
      status: nextStatus,
      discount_code: resolvedDiscount,
      expires_at: expiresAt,
      last_event: 'manual.email.sent',
      last_reminder_at: now,
      updated_at: now,
    })
    .eq('id', id);

  if (updateError) {
    console.error('[kiwify-hub] erro ao atualizar registro', updateError);
    return NextResponse.json({ error: 'E-mail enviado, mas não foi possível atualizar o registro.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, discountCode: resolvedDiscount, expiresAt });
}
