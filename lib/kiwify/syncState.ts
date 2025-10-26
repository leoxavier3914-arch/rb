import { getServiceClient } from '@/lib/supabase';
import type { SalesSyncState, SyncCursor } from './syncEngine';

const STATE_ID = 'kfy_sync_cursor';
const UNSUPPORTED_STATE_ID = 'kfy_unsupported_resources';
const SALES_STATE_ID = 'kfy_sales_sync_state';

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

export async function getUnsupportedResources(): Promise<Set<string>> {
  try {
    const client = getServiceClient();
    const { data, error } = await client.from('app_state').select('value').eq('id', UNSUPPORTED_STATE_ID).single();
    if (error) {
      console.warn(JSON.stringify({ level: 'warn', event: 'unsupported_resources_read_failed', error }));
      return new Set();
    }
    const value = data?.value;
    if (!value || typeof value !== 'object') {
      return new Set();
    }
    const entries = Object.entries(value as Record<string, unknown>);
    return new Set(entries.filter(([, enabled]) => Boolean(enabled)).map(([resource]) => resource));
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'unsupported_resources_unavailable', error }));
    return new Set();
  }
}

export async function setUnsupportedResources(resources: ReadonlySet<string>): Promise<void> {
  try {
    const payload = Object.fromEntries(Array.from(resources).map((resource) => [resource, true]));
    const client = getServiceClient();
    const { error } = await client.from('app_state').upsert({ id: UNSUPPORTED_STATE_ID, value: payload });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'unsupported_resources_write_failed', error }));
  }
}

export async function getSalesSyncState(): Promise<SalesSyncState | null> {
  try {
    const client = getServiceClient();
    const { data, error } = await client.from('app_state').select('value').eq('id', SALES_STATE_ID).single();
    if (error) {
      console.error(JSON.stringify({ level: 'error', event: 'sales_state_read_failed', error }));
      return null;
    }
    const value = data?.value;
    if (!value || typeof value !== 'object') {
      return null;
    }
    const payload = value as Record<string, unknown>;
    const lastPaidAt = typeof payload.lastPaidAt === 'string' ? payload.lastPaidAt : null;
    const lastCreatedAt = typeof payload.lastCreatedAt === 'string' ? payload.lastCreatedAt : null;
    return { lastPaidAt, lastCreatedAt };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'sales_state_unavailable', error }));
    return null;
  }
}

export async function setSalesSyncState(state: SalesSyncState): Promise<void> {
  try {
    const client = getServiceClient();
    const { error } = await client
      .from('app_state')
      .upsert({ id: SALES_STATE_ID, value: { lastPaidAt: state.lastPaidAt, lastCreatedAt: state.lastCreatedAt } });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'sales_state_write_failed', error }));
  }
}
