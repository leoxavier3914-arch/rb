import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { delByPrefix, METRICS_CACHE_PREFIXES } from '@/lib/cache';
import { runSync, type SyncRequest, type SyncResult } from '@/lib/kiwify/syncEngine';
import { buildRateLimitKey, checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  assertIsAdmin(request);

  const key = buildRateLimitKey(request, `${request.nextUrl.pathname}:reconcile`);
  const rateLimit = await checkRateLimit(key, 3, 120_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, code: 'rate_limited', error: 'Too many requests, try again soon.' },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as SyncRequest;
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  const syncResult = await runSync({
    ...body,
    range: body.range ?? { startDate: start, endDate: end }
  });

  if (body.persist) {
    await delByPrefix(METRICS_CACHE_PREFIXES);
  }

  return NextResponse.json(syncResult);
}
