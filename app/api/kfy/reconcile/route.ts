import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { delByPrefix, METRICS_CACHE_PREFIXES } from '@/lib/cache';
import { runSync, type SyncRequest, type SyncResult } from '@/lib/kiwify/syncEngine';
import { buildRateLimitKey, checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 300;

const DAY = 24 * 60 * 60 * 1000;

function formatDateOnly(value: Date): string {
  const copy = new Date(value);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
  const defaultEnd = formatDateOnly(now);
  const defaultStart = formatDateOnly(new Date(now.getTime() - 30 * DAY));

  const syncResult = await runSync({
    ...body,
    range: body.range ?? { startDate: defaultStart, endDate: defaultEnd }
  });

  if (body.persist) {
    await delByPrefix(METRICS_CACHE_PREFIXES);
  }

  if (!syncResult.ok) {
    const message = syncResult.logs.at(-1) ?? 'Falha ao reconciliar dados.';
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
