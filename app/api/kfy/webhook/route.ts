import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

const normalizeHex = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^(["'])(.*)\1$/, '$2').toLowerCase();
};

const verifySignature = (raw: string, provided: string | null) => {
  const secret = process.env.KIWIFY_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!provided) return false;
  try {
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (error) {
    console.error('Falha ao validar assinatura do webhook', error);
    return false;
  }
};

const parseBody = (raw: string) => {
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === 'object') {
      return json as Record<string, unknown>;
    }
  } catch (error) {
    console.error('Payload inválido do webhook', error);
  }
  return null;
};

const resolveSalePayload = (payload: Record<string, unknown>) => {
  const data = (payload.data ?? payload.sale ?? payload.payload) as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const id = typeof data.id === 'string' ? data.id : typeof data.sale_id === 'string' ? data.sale_id : null;
  if (!id) {
    return null;
  }

  return {
    id,
    status: typeof data.status === 'string' ? data.status : null,
    customer_id: typeof data.customer_id === 'string' ? data.customer_id : null,
    total_amount_cents: Number(data.total_amount_cents ?? data.amount ?? 0) || 0,
    created_at: typeof data.created_at === 'string' ? data.created_at : null,
    paid_at: typeof data.paid_at === 'string' ? data.paid_at : null,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = normalizeHex(request.headers.get('x-kiwify-signature') ?? request.headers.get('x-signature'));

  if (!verifySignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payload = parseBody(rawBody);
  if (!payload) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const eventId =
    (typeof payload.id === 'string' && payload.id) ||
    (typeof payload.event_id === 'string' && payload.event_id) ||
    (typeof payload.eventId === 'string' && payload.eventId);

  if (!eventId) {
    return NextResponse.json({ error: 'missing_event_id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupError } = await supabase.from('app_events').select('id').eq('id', eventId).maybeSingle();
  if (lookupError) {
    console.error('Falha ao verificar idempotência do webhook', lookupError);
    return NextResponse.json({ error: 'webhook_lookup_failed' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ ok: true, duplicated: true });
  }

  const sale = resolveSalePayload(payload);

  if (sale) {
    const { error: upsertError } = await supabase.from('kfy_sales').upsert(sale, { onConflict: 'id' });
    if (upsertError) {
      console.error('Falha ao atualizar venda a partir do webhook', upsertError);
      return NextResponse.json({ error: 'webhook_write_failed' }, { status: 500 });
    }
  }

  const { error: registerError } = await supabase
    .from('app_events')
    .insert({ id: eventId, payload, seen_at: new Date().toISOString() });

  if (registerError) {
    console.error('Falha ao registrar evento do webhook', registerError);
    return NextResponse.json({ error: 'webhook_event_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

