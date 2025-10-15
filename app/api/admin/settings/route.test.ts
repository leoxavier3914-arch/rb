import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from './route';
import type { HubSettings } from '../../../../lib/settings';

const getSettingsMock = vi.fn<[], Promise<HubSettings>>();
const updateSettingsMock = vi.fn<[any], Promise<HubSettings>>();

vi.mock('../../../../lib/settings', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/settings')>(
    '../../../../lib/settings',
  );
  return {
    ...actual,
    getSettings: () => getSettingsMock(),
    updateSettings: (input: any) => updateSettingsMock(input),
  };
});

describe('app/api/admin/settings route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ADMIN_TOKEN = 'super-secret';
    getSettingsMock.mockResolvedValue({
      id: 'default',
      default_delay_hours: 24,
      default_expire_hours: 72,
      kiwify_webhook_token: 'token',
      admin_token: 'super-secret',
      updated_at: null,
    });
    updateSettingsMock.mockResolvedValue({
      id: 'default',
      default_delay_hours: 12,
      default_expire_hours: 96,
      kiwify_webhook_token: 'new-token',
      admin_token: 'new-admin',
      updated_at: '2024-06-02T10:00:00.000Z',
    });
  });

  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it('returns unauthorized when the bearer token is invalid', async () => {
    const request = new Request('http://localhost/api/admin/settings');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns persisted settings on GET when authorized', async () => {
    const request = new Request('http://localhost/api/admin/settings', {
      headers: { Authorization: 'Bearer super-secret' },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.settings).toMatchObject({ default_delay_hours: 24, kiwify_webhook_token: 'token' });
  });

  it('validates payload and rejects malformed inputs', async () => {
    const request = new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer super-secret',
      },
      body: JSON.stringify({ default_delay_hours: 'invalid' }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('invalid_payload');
    expect(json.issues[0].path).toContain('default_delay_hours');
  });

  it('updates settings when payload is valid', async () => {
    const request = new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer super-secret',
      },
      body: JSON.stringify({
        default_delay_hours: 18,
        default_expire_hours: '120',
        kiwify_webhook_token: 'new-token',
        admin_token: 'new-admin',
      }),
    });

    const response = await PUT(request);

    expect(updateSettingsMock).toHaveBeenCalledWith({
      default_delay_hours: 18,
      default_expire_hours: 120,
      kiwify_webhook_token: 'new-token',
      admin_token: 'new-admin',
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.settings.updated_at).toBe('2024-06-02T10:00:00.000Z');
  });
});
