import { createHash } from 'node:crypto';
import { getServiceClient } from './supabase';

interface CacheEnvelope<T> {
  readonly v: T;
  readonly exp: string | null;
}

const TABLE = 'app_state';

export const METRICS_CACHE_PREFIXES = ['stats_cache:', 'top_products_cache:', 'geo_cache:'] as const;

function normalizeEnvelope<T>(value: unknown): CacheEnvelope<T> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const envelope = value as Partial<CacheEnvelope<T>>;
  return {
    v: envelope.v as T,
    exp: typeof envelope.exp === 'string' ? envelope.exp : null
  };
}

function isExpired(expiration: string | null): boolean {
  if (!expiration) {
    return false;
  }
  const timestamp = Date.parse(expiration);
  if (Number.isNaN(timestamp)) {
    return true;
  }
  return timestamp <= Date.now();
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const client = getServiceClient();
    const { data, error } = await client.from(TABLE).select('value').eq('id', key).single();
    if (error || !data) {
      return null;
    }

    const envelope = normalizeEnvelope<T>(data.value);
    if (!envelope) {
      await client.from(TABLE).delete().eq('id', key);
      return null;
    }

    if (isExpired(envelope.exp)) {
      await client.from(TABLE).delete().eq('id', key);
      return null;
    }

    return envelope.v ?? null;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'cache_read_failed', key, error }));
    return null;
  }
}

export async function setCache<T>(key: string, value: T, ttlMs = 300_000): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(1, ttlMs)).toISOString();
  try {
    const client = getServiceClient();
    const { error } = await client.from(TABLE).upsert({
      id: key,
      value: { v: value, exp: expiresAt }
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'cache_write_failed', key, error }));
  }
}

export async function delByPrefix(prefixes: readonly string[]): Promise<void> {
  try {
    const client = getServiceClient();
    for (const prefix of prefixes) {
      if (!prefix) {
        continue;
      }
      const { error } = await client.from(TABLE).delete().like('id', `${prefix}%`);
      if (error) {
        throw error;
      }
    }
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'cache_delete_failed', prefixes, error }));
  }
}

export function buildCacheKey(prefix: string, payload: unknown): string {
  const hash = createHash('sha1').update(JSON.stringify(payload ?? {})).digest('hex');
  return `${prefix}${hash}`;
}
