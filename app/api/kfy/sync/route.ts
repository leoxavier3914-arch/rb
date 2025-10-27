import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { delByPrefix, METRICS_CACHE_PREFIXES } from '@/lib/cache';
import { getSyncCursor, setSyncCursor } from '@/lib/kiwify/syncState';
import { runSync, type SyncRequest, type SyncResult } from '@/lib/kiwify/syncEngine';
import { buildRateLimitKey, checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const body = (await request.json().catch(() => ({}))) as SyncRequest & Record<string, unknown>;
  const bypassRateLimit = Boolean(body.full || body.persist);

  if (!bypassRateLimit) {
    const key = buildRateLimitKey(request, `${request.nextUrl.pathname}:sync`);
    const rateLimit = await checkRateLimit(key, 3, 120_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, code: 'rate_limited', error: 'Too many requests, try again soon.' },
        { status: 429 }
      );
    }
  }

  const hasCursorOverride = Object.prototype.hasOwnProperty.call(body, 'cursor');
  const cursor = hasCursorOverride ? (body.cursor ?? null) : await getSyncCursor();
  const syncResult = await runSync({ ...body, cursor });

  if (body.persist) {
    if (syncResult.nextCursor) {
      await setSyncCursor(syncResult.nextCursor);
    }
    await delByPrefix(METRICS_CACHE_PREFIXES);
  }

  if (!syncResult.ok) {
    const message = syncResult.logs.at(-1) ?? 'Falha ao executar sincronização.';
    return NextResponse.json(
      {
        ...syncResult,
        code: 'sync_failed',
        error: message
      },
      { status: 500 }
    );
  }

  return NextResponse.json(syncResult satisfies SyncResult);
}
