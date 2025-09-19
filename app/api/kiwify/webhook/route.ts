import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createCryptoId, resolveDiscountCode, resolveExpiration } from '../../../../lib/cryptoId';

const payloadSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.string().optional().nullable(),
    email: z.string().email(),
    name: z.string().optional().nullable(),
    product_id: z.string().optional().nullable(),
    product_name: z.string().optional().nullable(),
    checkout_url: z.string().url().optional().nullable(),
    discount_code: z.string().optional().nullable(),
    expires_in: z.union([z.number(), z.string()]).optional().nullable(),
  }),
});

function extractToken(request: NextRequest) {
  const headerToken = request.headers.get('x-kiwify-token') ?? request.headers.get('x-webhook-token');
  if (headerToken) {
    return headerToken;
  }
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return request.nextUrl.searchParams.get('token');
}

function normalizeStatus(event: string) {
  const normalized = event.toLowerCase();
  if (normalized.includes('purchase') || normalized.includes('approved') || normalized.includes('sale')) {
    return 'converted';
  }
  if (normalized.includes('error') || normalized.includes('fail')) {
    return 'error';
  }
  if (normalized.includes('email') || normalized.includes('sent')) {
    return 'sent';
  }
  return 'pending';
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.KIWIFY_WEBHOOK_TOKEN;
  const providedToken = extractToken(request);

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error('[kiwify-hub] JSON inválido', error);
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', details: parsed.error.flatten() }, { status: 400 });
  }

  const { event, data } = parsed.data;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error('[kiwify-hub] configuração do Supabase ausente', error);
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 500 });
  }

  const expiresInNumber = typeof data.expires_in === 'string' ? Number.parseInt(data.expires_in, 10) : data.expires_in ?? undefined;
  const discountCode = resolveDiscountCode(data.discount_code ?? undefined);
  const expiresAt = discountCode ? resolveExpiration(expiresInNumber ?? undefined) : null;
  const status = normalizeStatus(event);

  const identifierSeed = `${data.email}:${data.product_id ?? data.product_name ?? event}`;
  const recordId = data.id?.trim() || createCryptoId(identifierSeed);

  const { error } = await supabase
    .from('abandoned_emails')
    .upsert(
      {
        id: recordId,
        customer_email: data.email,
        customer_name: data.name ?? null,
        product_id: data.product_id ?? null,
        product_name: data.product_name ?? null,
        checkout_url: data.checkout_url ?? null,
        status,
        discount_code: discountCode,
        expires_at: expiresAt,
        last_event: event,
      },
      { onConflict: 'id' },
    );

  if (error) {
    console.error('[kiwify-hub] erro ao salvar evento', error);
    return NextResponse.json({ error: 'Não foi possível registrar o evento.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: recordId, status });
}
