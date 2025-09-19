import crypto from 'node:crypto';

const rawHours = Number(process.env.DEFAULT_EXPIRE_HOURS ?? '48');
const FALLBACK_HOURS = Number.isFinite(rawHours) ? rawHours : 48;

export function createCryptoId(seed: string): string {
  const token = process.env.KIWIFY_WEBHOOK_TOKEN ?? '';
  return crypto.createHash('sha256').update(`${seed}:${token}`).digest('hex');
}

export function resolveDiscountCode(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }
  const fallback = process.env.DEFAULT_DISCOUNT_CODE?.trim();
  return fallback && fallback.length > 0 ? fallback : null;
}

export function resolveExpiration(hours?: number | null): string {
  const parsedHours = typeof hours === 'number' && Number.isFinite(hours) ? hours : FALLBACK_HOURS;
  const expires = new Date(Date.now() + parsedHours * 60 * 60 * 1000);
  return expires.toISOString();
}
