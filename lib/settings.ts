import { readEnvValue } from './env';
import { getSupabaseAdmin } from './supabaseAdmin';

const TABLE_NAME = 'hub_settings';
const DEFAULT_ROW_ID = 'default';

export type HubSettings = {
  id: string;
  default_delay_hours: number | null;
  default_expire_hours: number | null;
  kiwify_webhook_token: string | null;
  admin_token: string | null;
  updated_at: string | null;
};

export type UpdateSettingsInput = Partial<{
  default_delay_hours: number | null;
  default_expire_hours: number | null;
  kiwify_webhook_token: string | null;
  admin_token: string | null;
}>;

type RawSettingsRow = Partial<HubSettings> & { id?: string };

type FallbackSettings = Omit<HubSettings, 'id' | 'updated_at'>;

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function coerceString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function getFallbackValues(): FallbackSettings {
  return {
    default_delay_hours: coerceNumber(readEnvValue('DEFAULT_DELAY_HOURS')),
    default_expire_hours: coerceNumber(readEnvValue('DEFAULT_EXPIRE_HOURS')),
    kiwify_webhook_token: coerceString(readEnvValue('KIWIFY_WEBHOOK_TOKEN')),
    admin_token: coerceString(readEnvValue('ADMIN_TOKEN')),
  };
}

function normalizeRow(row: RawSettingsRow | null, fallback: FallbackSettings): HubSettings {
  if (!row) {
    return {
      id: DEFAULT_ROW_ID,
      updated_at: null,
      ...fallback,
    };
  }

  return {
    id: row.id ?? DEFAULT_ROW_ID,
    default_delay_hours:
      coerceNumber(row.default_delay_hours) ?? fallback.default_delay_hours ?? null,
    default_expire_hours:
      coerceNumber(row.default_expire_hours) ?? fallback.default_expire_hours ?? null,
    kiwify_webhook_token:
      coerceString(row.kiwify_webhook_token) ?? fallback.kiwify_webhook_token ?? null,
    admin_token: coerceString(row.admin_token) ?? fallback.admin_token ?? null,
    updated_at: coerceString(row.updated_at),
  };
}

export async function getSettings(): Promise<HubSettings> {
  const supabase = getSupabaseAdmin();
  const fallback = getFallbackValues();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, default_delay_hours, default_expire_hours, kiwify_webhook_token, admin_token, updated_at')
    .eq('id', DEFAULT_ROW_ID)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar configurações: ${error.message ?? String(error)}`);
  }

  return normalizeRow(data ?? null, fallback);
}

export async function updateSettings(input: UpdateSettingsInput): Promise<HubSettings> {
  const supabase = getSupabaseAdmin();
  const fallback = getFallbackValues();

  const payload = {
    id: DEFAULT_ROW_ID,
    default_delay_hours: coerceNumber(input.default_delay_hours) ?? null,
    default_expire_hours: coerceNumber(input.default_expire_hours) ?? null,
    kiwify_webhook_token: coerceString(input.kiwify_webhook_token),
    admin_token: coerceString(input.admin_token),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'id' })
    .select('id, default_delay_hours, default_expire_hours, kiwify_webhook_token, admin_token, updated_at')
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar configurações: ${error.message ?? String(error)}`);
  }

  return normalizeRow(data ?? null, fallback);
}

export const __testables = {
  coerceNumber,
  coerceString,
  getFallbackValues,
  normalizeRow,
  TABLE_NAME,
  DEFAULT_ROW_ID,
};
