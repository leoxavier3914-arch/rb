import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

const SYNC_STATE_ID = 'kfy_sync_cursor';
const EXPORTS_BUCKET = 'exports';

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
  let dbStatus: HealthResponse['db'] = 'unknown';
  let storageStatus: HealthResponse['storage'] = 'unknown';
  let lastSyncAt: string | null = null;
  let failedEventsCount = 0;
  let jobsPending = 0;

  let client: ReturnType<typeof getServiceClient> | null = null;

  try {
    client = getServiceClient();
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'healthz_client_failed', error }));
  }

  if (client) {
    try {
      const [{ data: syncRow, error: syncError }, { count: failedCount, error: failedError }, { count: jobsCount, error: jobsError }]
        = await Promise.all([
          client
            .from('app_state')
            .select('value, updated_at')
            .eq('id', SYNC_STATE_ID)
            .maybeSingle(),
          client
            .from('app_events')
            .select('id', { head: true, count: 'exact' })
            .eq('status', 'failed'),
          client
            .from('jobs')
            .select('id', { head: true, count: 'exact' })
            .in('status', ['queued', 'running'])
        ]);

      if (syncError) {
        throw syncError;
      }

      const rawValue = (syncRow?.value ?? {}) as Record<string, unknown>;
      const lastRunCandidate = rawValue['last_run_at'];
      const altLastRunCandidate = rawValue['lastRunAt'];
      const explicitLastRun =
        typeof lastRunCandidate === 'string'
          ? lastRunCandidate
          : typeof altLastRunCandidate === 'string'
            ? altLastRunCandidate
            : null;

      lastSyncAt = explicitLastRun ?? syncRow?.updated_at ?? null;

      if (failedError) {
        throw failedError;
      }
      failedEventsCount = failedCount ?? 0;

      if (jobsError) {
        throw jobsError;
      }
      jobsPending = jobsCount ?? 0;

      dbStatus = 'ok';
    } catch (error) {
      dbStatus = 'unknown';
      console.error(JSON.stringify({ level: 'error', event: 'healthz_db_failed', error }));
    }

    try {
      const { error } = await client.storage.getBucket(EXPORTS_BUCKET);
      if (!error) {
        storageStatus = 'ok';
      } else {
        storageStatus = 'unknown';
        if (error) {
          console.warn(JSON.stringify({ level: 'warn', event: 'healthz_storage_missing', bucket: EXPORTS_BUCKET, error }));
        }
      }
    } catch (error) {
      storageStatus = 'unknown';
      console.error(JSON.stringify({ level: 'error', event: 'healthz_storage_failed', bucket: EXPORTS_BUCKET, error }));
    }
  }

  const payload: HealthResponse = {
    ok: true,
    db: dbStatus,
    storage: storageStatus,
    lastSyncAt,
    failedEventsCount,
    jobsPending
  };

  return NextResponse.json(payload);
}
