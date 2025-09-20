import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveDiscountCode, resolveExpiration } from '../../../../lib/cryptoId';
import { getEmailJsConfig } from '../../../../lib/emailJsConfig';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

const payloadSchema = z
  .object({
    checkout_id: z.string().min(1),
    email: z.string().email().optional().nullable(),
    customer_email: z.string().email().optional().nullable(),
    name: z.string().optional().nullable(),
    product_name: z.string().optional().nullable(),
    checkout_url: z.string().url(),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.customer_email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'E-mail obrigatório.',
        path: ['email'],
      });
    }
  });

function resolveRecordId(value: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value) ? value : randomUUID();
}

async function ensureTestRecord(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    id: string;
    email: string;
    name: string | null;
    productName: string | null;
    checkoutUrl: string;
    discountCode: string | null;
    expiresAt: string | null;
  },
) {
  const { error } = await supabase
    .from('abandoned_emails')
    .upsert(
      {
        id: params.id,
        customer_email: params.email,
        customer_name: params.name,
        product_id: null,
        product_name: params.productName,
        checkout_url: params.checkoutUrl,
        status: 'pending',
        discount_code: params.discountCode,
        expires_at: params.expiresAt,
        last_event: 'manual.test.created',
      },
      { onConflict: 'id' },
    );

  if (error) {
    throw error;
  }
}

async function markTestAsSent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: { id: string; discountCode: string | null; expiresAt: string | null; sentAt: string },
) {
  const { error } = await supabase
    .from('abandoned_emails')
    .update({
      status: 'sent',
      discount_code: params.discountCode,
      expires_at: params.expiresAt,
      last_event: 'manual.test.sent',
      last_reminder_at: params.sentAt,
    })
    .eq('id', params.id);

  if (error) {
    throw error;
  }
}

async function markTestAsError(supabase: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const { error } = await supabase
    .from('abandoned_emails')
    .update({
      status: 'error',
      last_event: 'manual.test.failed',
      last_reminder_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  const cookieToken = cookies().get('admin_token')?.value;

  if (!adminToken || cookieToken !== adminToken) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error('[kiwify-hub] configuração do Supabase ausente', error);
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 500 });
  }

  const {
    checkout_id: checkoutId,
    email: payloadEmail,
    customer_email: payloadCustomerEmail,
    name,
    product_name: productName,
    checkout_url: checkoutUrl,
  } = parsed.data;

  const recordId = resolveRecordId(checkoutId);

  const normalizedEmail = (payloadEmail ?? payloadCustomerEmail ?? '').trim().toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });
  }

  const discountCode = resolveDiscountCode();
  const expiresAt = discountCode ? resolveExpiration(undefined) : null;

  try {
    await ensureTestRecord(supabase, {
      id: recordId,
      email: normalizedEmail,
      name: name ?? null,
      productName: productName ?? null,
      checkoutUrl,
      discountCode,
      expiresAt,
    });
  } catch (error) {
    console.error('[kiwify-hub] erro ao registrar teste', error);
    return NextResponse.json({ error: 'Não foi possível registrar o teste.' }, { status: 500 });
  }

  let serviceId: string;
  let templateId: string;
  let publicKey: string;
  try {
    ({ serviceId, templateId, publicKey } = getEmailJsConfig());
  } catch (error) {
    console.error('[kiwify-hub] configuração do EmailJS ausente', error);
    try {
      await markTestAsError(supabase, recordId);
    } catch (updateError) {
      console.error('[kiwify-hub] falha ao marcar teste como erro', updateError);
    }
    return NextResponse.json({ error: 'Serviço de e-mail indisponível.' }, { status: 500 });
  }

  const templateParams = {
    to_email: normalizedEmail,
    to_name: name ?? 'Cliente',
    product_name: productName ?? 'Produto Kiwify',
    checkout_url: checkoutUrl,
    discount_code: discountCode ?? '',
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
    console.error('[kiwify-hub] erro de rede ao enviar teste', error);
    try {
      await markTestAsError(supabase, recordId);
    } catch (updateError) {
      console.error('[kiwify-hub] falha ao marcar teste como erro', updateError);
    }
    return NextResponse.json({ error: 'Falha ao enviar e-mail.' }, { status: 502 });
  }

  if (!response.ok) {
    const message = await response.text();
    console.error('[kiwify-hub] erro ao enviar teste', response.status, message);
    try {
      await markTestAsError(supabase, recordId);
    } catch (updateError) {
      console.error('[kiwify-hub] falha ao marcar teste como erro', updateError);
    }
    return NextResponse.json({ error: 'Falha ao enviar e-mail.' }, { status: 502 });
  }

  const sentAt = new Date().toISOString();
  try {
    await markTestAsSent(supabase, {
      id: recordId,
      discountCode,
      expiresAt,
      sentAt,
    });
  } catch (error) {
    console.error('[kiwify-hub] erro ao atualizar teste enviado', error);
    return NextResponse.json({ error: 'E-mail enviado, mas não foi possível atualizar o registro.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: recordId, status: 'sent', discountCode, expiresAt });
}
