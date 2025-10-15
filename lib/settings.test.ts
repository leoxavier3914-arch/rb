import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubSettings } from './settings';
import { __testables, getSettings, updateSettings } from './settings';

const mockFrom = vi.fn();
const mockGetSupabaseAdmin = vi.fn(() => ({ from: mockFrom }));

vi.mock('./supabaseAdmin', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

function createSelectChain(result: { data: Partial<HubSettings> | null; error: any }) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => result),
      })),
    })),
  };
}

function createUpsertChain(result: { data: Partial<HubSettings>; error: any }, spy?: (payload: any) => void) {
  return {
    upsert: vi.fn((payload: any) => {
      spy?.(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => result),
        })),
      };
    }),
  };
}

describe('lib/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockGetSupabaseAdmin.mockReturnValue({ from: mockFrom });

    process.env.DEFAULT_DELAY_HOURS = '24';
    process.env.DEFAULT_EXPIRE_HOURS = '72';
    process.env.KIWIFY_WEBHOOK_TOKEN = 'env-webhook-token';
    process.env.ADMIN_TOKEN = 'env-admin-token';
  });

  afterEach(() => {
    delete process.env.DEFAULT_DELAY_HOURS;
    delete process.env.DEFAULT_EXPIRE_HOURS;
    delete process.env.KIWIFY_WEBHOOK_TOKEN;
    delete process.env.ADMIN_TOKEN;
    mockFrom.mockReset();
  });

  it('returns fallback values when table has no row', async () => {
    mockFrom.mockReturnValueOnce(createSelectChain({ data: null, error: null }));

    const settings = await getSettings();

    expect(settings).toMatchObject({
      id: __testables.DEFAULT_ROW_ID,
      default_delay_hours: 24,
      default_expire_hours: 72,
      kiwify_webhook_token: 'env-webhook-token',
      admin_token: 'env-admin-token',
    });
  });

  it('normalizes numeric and string values from storage', async () => {
    mockFrom.mockReturnValueOnce(
      createSelectChain({
        data: {
          id: 'default',
          default_delay_hours: '12',
          default_expire_hours: 96,
          kiwify_webhook_token: 'stored-token',
          admin_token: null,
          updated_at: '2024-06-01T10:00:00.000Z',
        },
        error: null,
      }),
    );

    const settings = await getSettings();

    expect(settings).toEqual({
      id: 'default',
      default_delay_hours: 12,
      default_expire_hours: 96,
      kiwify_webhook_token: 'stored-token',
      admin_token: 'env-admin-token',
      updated_at: '2024-06-01T10:00:00.000Z',
    });
  });

  it('upserts values and returns the normalized payload', async () => {
    const upsertSpy = vi.fn();

    mockFrom.mockReturnValueOnce({
      ...createSelectChain({ data: null, error: null }),
      ...createUpsertChain(
        {
          data: {
            id: 'default',
            default_delay_hours: 18,
            default_expire_hours: 120,
            kiwify_webhook_token: 'updated-token',
            admin_token: 'new-admin-token',
            updated_at: '2024-06-02T12:00:00.000Z',
          },
          error: null,
        },
        upsertSpy,
      ),
    });

    const updated = await updateSettings({
      default_delay_hours: 18,
      default_expire_hours: 120,
      kiwify_webhook_token: 'updated-token',
      admin_token: 'new-admin-token',
    });

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'default',
        default_delay_hours: 18,
        default_expire_hours: 120,
        kiwify_webhook_token: 'updated-token',
        admin_token: 'new-admin-token',
      }),
    );

    expect(updated).toEqual({
      id: 'default',
      default_delay_hours: 18,
      default_expire_hours: 120,
      kiwify_webhook_token: 'updated-token',
      admin_token: 'new-admin-token',
      updated_at: '2024-06-02T12:00:00.000Z',
    });
  });
});
