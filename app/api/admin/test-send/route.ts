import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveDiscountCode, resolveExpiration } from '../../../../lib/cryptoId';
import {
  EmailJsApiError,
  getEmailJsConfig,
  sendEmailJsTemplate,
} from '../../../../lib/emailJsConfig';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { applyDiscountToCheckoutUrl } from '../../../../lib/checkout';

const payloadSchema = z
  .object({
    checkout_id: z.string().min(1),
    email: z.string().email().optional().nullable(),
    customer_email: z.string().email().optional().nullable(),
    name: z.string().optional().nullable(),
    product_name: z.string().optional().nullable(),
    checkout_url: z.string().url().optional().nullable(),
    template_id: z.string().min(1).optional().nullable(),
    template_params: z.record(z.string().min(1)).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasEmailCandidate = Boolean(
      (data.email && data.email.trim()) ||
        (data.customer_email && data.customer_email.trim()) ||
        (data.template_params && typeof data.template_params === 'object' && data.template_params.to_email),
    );

    if (!hasEmailCandidate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'E-mail obrigatório.',
        path: ['email'],
      });
    }

    const hasCheckout = Boolean(
      (data.checkout_url && data.checkout_url.trim()) ||
        (data.template_params && typeof data.template_params === 'object' && data.template_params.checkout_url),
    );

    if (!hasCheckout) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Checkout URL obrigatório.',
        path: ['checkout_url'],
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
    checkoutId: string;
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
        checkout_id: params.checkoutId,
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
    checkout_url: payloadCheckoutUrl,
    template_id: providedTemplateId,
    template_params: providedTemplateParams,
  } = parsed.data;

  const recordId = resolveRecordId(checkoutId);

  const templateParamsInput: Record<string, string> = providedTemplateParams ?? {};

  const normalizedEmail = (
    payloadEmail ??
    payloadCustomerEmail ??
    templateParamsInput['to_email'] ??
    templateParamsInput['toEmail'] ??
    ''
  )
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });
  }

  const checkoutUrl = (payloadCheckoutUrl ?? templateParamsInput['checkout_url'] ?? '').trim();

  if (!checkoutUrl) {
    return NextResponse.json({ error: 'Checkout URL obrigatório.' }, { status: 400 });
  }

  const discountCode = resolveDiscountCode();
  const expiresAt = discountCode ? resolveExpiration(undefined) : null;
  const checkoutLink = applyDiscountToCheckoutUrl(checkoutUrl, discountCode);

  const resolvedName = templateParamsInput['name'] ?? name ?? 'Cliente';
  const resolvedProductName = templateParamsInput['product_name'] ?? productName ?? 'Produto Kiwify';

  const templateParams: Record<string, string | null> = {
    ...templateParamsInput,
    to_email: normalizedEmail,
    name: resolvedName,
    product_name: resolvedProductName,
    checkout_url: checkoutLink,
    discount_code: discountCode ?? '',
    expires_at: expiresAt,
  };

  try {
    await ensureTestRecord(supabase, {
      id: recordId,
      checkoutId,
      email: normalizedEmail,
      name: resolvedName ?? null,
      productName: resolvedProductName ?? null,
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
  let privateKey: string;
  try {
    ({ serviceId, templateId, publicKey, privateKey } = getEmailJsConfig());
  } catch (error) {
    console.error('[kiwify-hub] configuração do EmailJS ausente', error);
    try {
      await markTestAsError(supabase, recordId);
    } catch (updateError) {
      console.error('[kiwify-hub] falha ao marcar teste como erro', updateError);
    }
    return NextResponse.json({ error: 'Serviço de e-mail indisponível.' }, { status: 500 });
  }

  if (providedTemplateId && providedTemplateId.trim()) {
    templateId = providedTemplateId.trim();
  }

  try {
    await sendEmailJsTemplate({
      serviceId,
      templateId,
      publicKey,
      accessToken: privateKey,
      templateParams,
    });
  } catch (error) {
    if (error instanceof EmailJsApiError) {
      console.error('[kiwify-hub] erro ao enviar teste', error.status, error.body);
    } else {
      console.error('[kiwify-hub] erro de rede ao enviar teste', error);
    }
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
