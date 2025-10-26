import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface HealthResponse {
  readonly ok: boolean;
  readonly db: 'ok' | 'unknown';
  readonly storage: 'ok' | 'unknown';
  readonly lastSyncAt: string | null;
  readonly failedEventsCount: number;
  readonly jobsPending: number;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const payload: HealthResponse = {
    ok: true,
    db: 'unknown',
    storage: 'unknown',
    lastSyncAt: null,
    failedEventsCount: 0,
    jobsPending: 0
  };

  return NextResponse.json(payload);
}
