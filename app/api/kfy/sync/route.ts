import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { delByPrefix, METRICS_CACHE_PREFIXES } from '@/lib/cache';
import { getSyncCursor, setSyncCursor } from '@/lib/kiwify/syncState';
import { runSync, type SyncRequest, type SyncResult } from '@/lib/kiwify/syncEngine';
import { buildRateLimitKey, checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  assertIsAdmin(request);

  const key = buildRateLimitKey(request, `${request.nextUrl.pathname}:sync`);
  const rateLimit = await checkRateLimit(key, 3, 120_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', error: 'Too many requests, try again soon.' },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as SyncRequest;
  const cursor = body.cursor ?? (await getSyncCursor());
  const syncResult = await runSync({ ...body, cursor });

  if (body.persist) {
    if (syncResult.nextCursor) {
      await setSyncCursor(syncResult.nextCursor);
    }
    await delByPrefix(METRICS_CACHE_PREFIXES);
  }

  return NextResponse.json(syncResult);
}
