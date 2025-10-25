import { getServiceClient } from '@/lib/supabase';
import type { SyncCursor } from './syncEngine';

const STATE_ID = 'kfy_sync_cursor';

export async function getSyncCursor(): Promise<SyncCursor | null> {
  try {
    const client = getServiceClient();
    const { data, error } = await client.from('app_state').select('value').eq('id', STATE_ID).single();
    if (error) {
      console.error(JSON.stringify({ level: 'error', event: 'sync_state_read_failed', error }));
      return null;
    }
    return (data?.value as SyncCursor | null) ?? null;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'sync_state_unavailable', error }));
    return null;
  }
}

export async function setSyncCursor(cursor: SyncCursor): Promise<void> {
  try {
    const client = getServiceClient();
    const { error } = await client.from('app_state').upsert({ id: STATE_ID, value: cursor });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'sync_state_write_failed', error }));
  }
}
