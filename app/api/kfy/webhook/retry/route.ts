import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { delByPrefix, METRICS_CACHE_PREFIXES } from '@/lib/cache';
import { processKiwifyEvent } from '@/lib/kiwify/webhookProcessor';
import { extractEventDetails, isRecord } from '@/lib/kiwify/webhookUtils';
import { getServiceClient } from '@/lib/supabase';
import { buildRateLimitKey, checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface FailedEventRow {
  readonly id: string;
  readonly type: string | null;
  readonly payload: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const key = buildRateLimitKey(request, `${request.nextUrl.pathname}:retry`);
  const result = await checkRateLimit(key, 3, 60_000);
  if (!result.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', error: 'Too many requests, try again soon.' },
      { status: 429 }
    );
  }

  let client: ReturnType<typeof getServiceClient>;
  try {
    client = getServiceClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar cliente Supabase.';
    return jsonError('webhook_retry_failed', message);
  }
  const { data, error } = await client
    .from('app_events')
    .select('id, type, payload')
    .eq('status', 'failed')
    .order('seen_at', { ascending: true, nullsFirst: true })
    .limit(20);

  if (error) {
    return jsonError('webhook_retry_failed', `Falha ao carregar eventos pendentes: ${error.message ?? 'erro desconhecido'}`);
  }

  const rows = (data ?? []) as FailedEventRow[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, retried: 0, processed: 0 });
  }

  let retried = 0;
  let processed = 0;
  let metricsInvalidated = false;

  for (const row of rows) {
    retried += 1;
    const payloadRecord = isRecord(row.payload) ? row.payload : {};
    const rawBody = JSON.stringify(payloadRecord ?? {});
    const details = extractEventDetails(payloadRecord, rawBody, row.type);
    const seenAt = new Date().toISOString();

    await client.from('app_events').update({ status: 'processing', seen_at: seenAt }).eq('id', row.id);

    try {
      const { metricsChanged } = await processKiwifyEvent(client, details.eventType, details.eventPayload, payloadRecord);
      await client
        .from('app_events')
        .update({ status: 'processed', error: null, seen_at: seenAt })
        .eq('id', row.id);
      processed += 1;
      metricsInvalidated = metricsInvalidated || metricsChanged;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao reprocessar webhook.';
      const trimmed = message.length > 180 ? `${message.slice(0, 177)}...` : message;
      await client
        .from('app_events')
        .update({ status: 'failed', error: trimmed, seen_at: seenAt })
        .eq('id', row.id);
    }
  }

  if (metricsInvalidated) {
    await delByPrefix(METRICS_CACHE_PREFIXES);
  }

  return NextResponse.json({ ok: true, retried, processed });
}

function jsonError(code: string, error: string): NextResponse {
  return NextResponse.json({ ok: false, code, error }, { status: 500 });
}
