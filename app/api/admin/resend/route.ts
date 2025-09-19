import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { resolveDiscountCode, resolveExpiration } from '../../../../lib/cryptoId';

const resendSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional().nullable(),
  checkoutUrl: z.string().url().optional().nullable(),
  discountCode: z.string().optional().nullable(),
  expiresInHours: z.union([z.number(), z.string()]).optional().nullable(),
});

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

function ensureEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada.`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  const header = request.headers.get('authorization');

  if (!adminToken || header !== `Bearer ${adminToken}`) {
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
    .from('abandoned_carts')
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
    serviceId = ensureEnv('EMAILJS_SERVICE_ID');
    templateId = ensureEnv('EMAILJS_TEMPLATE_ID');
    publicKey = ensureEnv('EMAILJS_PUBLIC_KEY');
  } catch (error) {
    console.error('[kiwify-hub] configuração do EmailJS ausente', error);
    return NextResponse.json({ error: 'Serviço de e-mail indisponível.' }, { status: 500 });
  }

  const templateParams = {
    to_email: email ?? record.customer_email,
    to_name: name ?? record.customer_name ?? 'Cliente',
    product_name: record.product_name ?? 'Produto Kiwify',
    checkout_url: checkoutUrl ?? record.checkout_url ?? '',
    discount_code: resolvedDiscount ?? '',
    expires_at: expiresAt,
  };

  const response = await fetch(EMAILJS_ENDPOINT, {
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

  if (!response.ok) {
    const message = await response.text();
    console.error('[kiwify-hub] erro ao enviar e-mail', response.status, message);
    return NextResponse.json({ error: 'Falha ao enviar e-mail.' }, { status: 502 });
  }

  const { error: updateError } = await supabase
    .from('abandoned_carts')
    .update({
      status: 'sent',
      discount_code: resolvedDiscount,
      expires_at: expiresAt,
      last_event: 'manual.email.sent',
    })
    .eq('id', id);

  if (updateError) {
    console.error('[kiwify-hub] erro ao atualizar registro', updateError);
    return NextResponse.json({ error: 'E-mail enviado, mas não foi possível atualizar o registro.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, discountCode: resolvedDiscount, expiresAt });
}
