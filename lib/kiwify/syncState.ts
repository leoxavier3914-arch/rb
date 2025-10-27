import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase';

const STATE_ID = 'kfy_sync_cursor';

const metadataSchema = z.object({
  last_run_at: z.string(),
  resources: z.array(z.string()).optional(),
  since: z.string().nullable().optional(),
  until: z.string().nullable().optional()
});

export interface SyncMetadata {
  readonly lastRunAt: string;
  readonly resources: readonly string[] | null;
  readonly since: string | null;
  readonly until: string | null;
}

export async function setSyncMetadata(metadata: SyncMetadata): Promise<void> {
  try {
    const client = getServiceClient();
    const payload = {
      last_run_at: metadata.lastRunAt,
      resources: metadata.resources && metadata.resources.length > 0 ? metadata.resources : undefined,
      since: metadata.since,
      until: metadata.until
    };
    const { error } = await client.from('app_state').upsert({ id: STATE_ID, value: payload });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'sync_metadata_write_failed', error }));
  }
}

export async function getSyncMetadata(): Promise<SyncMetadata | null> {
  try {
    const client = getServiceClient();
    const { data, error } = await client.from('app_state').select('value').eq('id', STATE_ID).maybeSingle();
    if (error || !data) {
      return null;
    }
    const parsed = metadataSchema.safeParse(data.value);
    if (!parsed.success) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          event: 'sync_metadata_invalid',
          error: parsed.error.message
        })
      );
      return null;
    }
    return {
      lastRunAt: parsed.data.last_run_at,
      resources: parsed.data.resources ?? null,
      since: parsed.data.since ?? null,
      until: parsed.data.until ?? null
    };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'sync_metadata_read_failed', error }));
    return null;
  }
}
