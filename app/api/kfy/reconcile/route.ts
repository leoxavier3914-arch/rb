import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { runSync, type SyncRequest, type SyncResult } from '@/lib/kiwify/syncEngine';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse<SyncResult>> {
  assertIsAdmin(request);

  const body = (await request.json().catch(() => ({}))) as SyncRequest;
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  const result = await runSync({
    ...body,
    range: body.range ?? { startDate: start, endDate: end }
  });

  return NextResponse.json(result);
}
