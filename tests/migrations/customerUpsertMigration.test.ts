import { afterEach, describe, expect, it, vi } from 'vitest';
import * as env from '@/lib/env';
import * as supabase from '@/lib/supabase';
import { upsertCustomer } from '@/lib/kiwify/writes';
import type { CustomerRow } from '@/lib/kiwify/mappers';

const baseCustomer: CustomerRow = {
  id: 'cust_explicit',
  name: null,
  email: null,
  phone: null,
  country: null,
  state: null,
  city: null,
  created_at: null,
  updated_at: null,
  raw: {}
};

describe('customer upsert migration safeguards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logga dica quando o banco recusa id explícito por identity', async () => {
    vi.spyOn(env, 'loadEnv').mockReturnValue({} as env.AppEnv);
    const upsertMock = vi.fn().mockResolvedValue({
      error: {
        message: 'cannot insert a non-DEFAULT value into column "id"',
        details: 'Column is identity',
        code: '23505'
      }
    });
    vi.spyOn(supabase, 'getServiceClient').mockReturnValue({
      from: () => ({
        upsert: upsertMock
      })
    } as unknown as ReturnType<typeof supabase.getServiceClient>);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(upsertCustomer(baseCustomer)).rejects.toThrow(/Failed to upsert/);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('column id must be non-identity / no default')
    );
  });

  it('não chama o banco quando o id é inválido', async () => {
    vi.spyOn(env, 'loadEnv').mockReturnValue({} as env.AppEnv);
    const clientSpy = vi.spyOn(supabase, 'getServiceClient');

    const result = await upsertCustomer({ ...baseCustomer, id: '   ' });

    expect(result).toBe(0);
    expect(clientSpy).not.toHaveBeenCalled();
  });
});
