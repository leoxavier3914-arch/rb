import { describe, expect, it } from 'vitest';
import { assertIsAdmin } from '@/lib/auth';

function buildRequest(headers: Record<string, string | undefined>) {
  return new Request('https://example.com/api/test', {
    headers: new Headers(headers)
  }) as unknown as import('next/server').NextRequest;
}

describe('assertIsAdmin', () => {
  it('permite quando admin e origem válida', () => {
    process.env.ALLOWED_ORIGINS = 'example.com';
    const request = buildRequest({ 'x-admin-role': 'true', origin: 'https://example.com' });
    expect(() => assertIsAdmin(request)).not.toThrow();
  });

  it('bloqueia quando admin ausente', () => {
    const request = buildRequest({});
    expect(() => assertIsAdmin(request)).toThrowErrorMatchingInlineSnapshot(
      `"Response "`
    );
  });
});
