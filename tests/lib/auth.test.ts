import { beforeEach, describe, expect, it } from 'vitest';

import { assertIsAdmin } from '@/lib/auth';

const buildRequest = (headers: Record<string, string>) =>
  new Request('http://localhost/api/test', {
    headers: new Headers({ 'x-admin-role': 'true', ...headers }),
  });

beforeEach(() => {
  process.env.ALLOWED_ORIGINS = '';
});

describe('assertIsAdmin', () => {
  it('permite admin quando não há origens configuradas', async () => {
    const request = buildRequest({});
    await expect(assertIsAdmin(request)).resolves.toBeUndefined();
  });

  it('aceita curingas em ALLOWED_ORIGINS', async () => {
    process.env.ALLOWED_ORIGINS = '*.vercel.app';
    const request = buildRequest({ origin: 'https://foo.vercel.app' });
    await expect(assertIsAdmin(request)).resolves.toBeUndefined();
  });

  it('aceita host quando origin ausente', async () => {
    process.env.ALLOWED_ORIGINS = 'dashboard.local';
    const request = buildRequest({ host: 'dashboard.local' });
    await expect(assertIsAdmin(request)).resolves.toBeUndefined();
  });
});

