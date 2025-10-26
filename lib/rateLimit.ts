import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

interface RateLimitState {
  readonly timestamps: number[];
}

interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
}

const PREFIX = 'ratelimit:';

function parseState(value: unknown): RateLimitState {
  if (!value || typeof value !== 'object') {
    return { timestamps: [] };
  }
  const record = value as Partial<RateLimitState>;
  const entries = Array.isArray(record.timestamps) ? record.timestamps : [];
  const timestamps = entries.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry));
  return { timestamps };
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - Math.max(0, windowMs);
  const id = `${PREFIX}${key}`;
  try {
    const client = getServiceClient();
    const { data, error } = await client
      .from('app_state')
      .select('value')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const state = parseState(data?.value ?? null);
    const recent = state.timestamps.filter((timestamp) => timestamp >= windowStart);

    if (recent.length >= limit) {
      return { allowed: false, remaining: 0 };
    }

    recent.push(now);
    const remaining = Math.max(0, limit - recent.length);

    await client
      .from('app_state')
      .upsert({ id, value: { timestamps: recent } });

    return { allowed: true, remaining };
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'ratelimit_check_failed', key, error }));
    return { allowed: true, remaining: limit };
  }
}

function resolveClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  return request.ip ?? 'unknown';
}

export function buildRateLimitKey(request: NextRequest, scope: string): string {
  const ip = resolveClientIp(request);
  return `${scope}:${ip}`;
}
