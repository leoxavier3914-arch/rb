import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { delByPrefix, METRICS_CACHE_PREFIXES } from '@/lib/cache';
import { loadEnv } from '@/lib/env';
import { processKiwifyEvent } from '@/lib/kiwify/webhookProcessor';
import { extractEventDetails } from '@/lib/kiwify/webhookUtils';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface EventRow {
  readonly status: string | null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const rawBody = await request.text();
  let body: unknown;

  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonError('invalid_payload', 'Payload inválido recebido no webhook.', 400);
  }

  if (await isInvalidSignature(request, rawBody)) {
    return jsonError('invalid_signature', 'Assinatura do webhook inválida.', 401);
  }

  const { eventId, eventType, eventPayload } = extractEventDetails(body, rawBody);
  const client = getServiceClient();
  const nowIso = new Date().toISOString();

  let existing: EventRow | null = null;
  try {
    existing = await loadEvent(client, eventId);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'webhook_event_load_failed', id: eventId, error }));
    return jsonError('webhook_failed', 'Falha ao verificar idempotência do webhook.', 500);
  }
  if (existing?.status === 'processed') {
    await markEventSeen(client, eventId, nowIso);
    return NextResponse.json({ ok: true, idempotent: true });
  }

  await upsertEvent(client, eventId, eventType, body, nowIso);

  try {
    const { metricsChanged } = await processKiwifyEvent(client, eventType, eventPayload, body);
    await markEventProcessed(client, eventId, nowIso);

    if (metricsChanged) {
      await delByPrefix(METRICS_CACHE_PREFIXES);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao processar webhook.';
    await markEventFailed(client, eventId, nowIso, message);
    return jsonError('webhook_failed', 'Falha ao processar webhook.', 500);
  }
}

async function isInvalidSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const env = loadEnv();
  if (!env.KIWIFY_WEBHOOK_SECRET) {
    return false;
  }
  const headerSignature = request.headers.get('x-signature');
  if (!headerSignature) {
    return true;
  }

  const hmac = createHmac('sha256', env.KIWIFY_WEBHOOK_SECRET);
  const computed = hmac.update(rawBody).digest('hex');
  const sanitized = headerSignature.startsWith('sha256=') ? headerSignature.slice(7) : headerSignature;
  try {
    const expectedBuffer = Buffer.from(computed, 'hex');
    const receivedBuffer = Buffer.from(sanitized, 'hex');
    if (expectedBuffer.length !== receivedBuffer.length) {
      return true;
    }
    return !timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return true;
  }
}

async function loadEvent(client: ReturnType<typeof getServiceClient>, id: string): Promise<EventRow | null> {
  const { data, error } = await client.from('app_events').select('status').eq('id', id).limit(1);
  if (error) {
    throw new Error(`Falha ao carregar evento ${id}: ${error.message ?? 'erro desconhecido'}`);
  }
  if (!data || data.length === 0) {
    return null;
  }
  const row = data[0] as Partial<EventRow>;
  return { status: typeof row.status === 'string' ? row.status : null };
}

async function upsertEvent(
  client: ReturnType<typeof getServiceClient>,
  id: string,
  type: string,
  payload: unknown,
  seenAt: string
): Promise<void> {
  const { error } = await client.from('app_events').upsert({
    id,
    source: 'kiwify',
    type,
    status: 'processing',
    payload,
    error: null,
    seen_at: seenAt
  });
  if (error) {
    throw new Error(`Falha ao registrar evento ${id}: ${error.message ?? 'erro desconhecido'}`);
  }
}

async function markEventProcessed(client: ReturnType<typeof getServiceClient>, id: string, seenAt: string): Promise<void> {
  const { error } = await client
    .from('app_events')
    .update({ status: 'processed', error: null, seen_at: seenAt })
    .eq('id', id);
  if (error) {
    throw new Error(`Falha ao atualizar evento ${id}: ${error.message ?? 'erro desconhecido'}`);
  }
}

async function markEventFailed(
  client: ReturnType<typeof getServiceClient>,
  id: string,
  seenAt: string,
  message: string
): Promise<void> {
  const trimmed = message.length > 180 ? `${message.slice(0, 177)}...` : message;
  const { error } = await client
    .from('app_events')
    .update({ status: 'failed', error: trimmed, seen_at: seenAt })
    .eq('id', id);
  if (error) {
    console.error(JSON.stringify({ level: 'error', event: 'webhook_event_mark_failed_error', id, error }));
  }
}

async function markEventSeen(client: ReturnType<typeof getServiceClient>, id: string, seenAt: string): Promise<void> {
  const { error } = await client.from('app_events').update({ seen_at: seenAt }).eq('id', id);
  if (error) {
    console.error(JSON.stringify({ level: 'warn', event: 'webhook_event_seen_failed', id, error }));
  }
}

function jsonError(code: string, error: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, code, error }, { status });
}
