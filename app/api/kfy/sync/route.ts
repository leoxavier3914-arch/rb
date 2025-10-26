import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { delByPrefix, METRICS_CACHE_PREFIXES } from '@/lib/cache';
import { getSyncCursor, setSyncCursor } from '@/lib/kiwify/syncState';
import { runSync, type SyncRequest, type SyncResult } from '@/lib/kiwify/syncEngine';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  assertIsAdmin(request);

  const body = (await request.json().catch(() => ({}))) as SyncRequest;
  const cursor = body.cursor ?? (await getSyncCursor());
  const result = await runSync({ ...body, cursor });

  if (body.persist) {
    if (result.nextCursor) {
      await setSyncCursor(result.nextCursor);
    }
    await delByPrefix(METRICS_CACHE_PREFIXES);
  }

  return NextResponse.json(result);
}
