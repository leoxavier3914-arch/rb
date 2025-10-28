import { describe, expect, it } from 'vitest';
import { assertIsAdmin } from '@/lib/auth';

function buildRequest(headers: Record<string, string | undefined>) {
  const normalized = Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== undefined);
  return new Request('https://example.com/api/test', {
    headers: new Headers(normalized)
  }) as unknown as import('next/server').NextRequest;
}

describe('assertIsAdmin', () => {
  it('permite quando admin e origem válida', () => {
    process.env.ALLOWED_ORIGINS = 'example.com';
    const request = buildRequest({ 'x-admin-role': 'true', origin: 'https://example.com' });
    expect(() => assertIsAdmin(request)).not.toThrow();
  });

  it('bloqueia quando admin ausente', async () => {
    const request = buildRequest({});
    try {
      assertIsAdmin(request);
      throw new Error('Expected assertIsAdmin to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const response = error as Response;
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        ok: false,
        code: 'NO_ADMIN',
        error: 'not_authorized'
      });
    }
  });
});
