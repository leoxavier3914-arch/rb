import { getServiceClient } from '@/lib/supabase';

export interface WebhookSetting {
  readonly webhookId: string;
  readonly name: string | null;
  readonly url: string | null;
  readonly token: string | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

type WebhookSettingRow = {
  readonly webhook_id: string;
  readonly name: string | null;
  readonly url: string | null;
  readonly token: string | null;
  readonly is_active: boolean;
  readonly updated_at: string;
};

export async function listWebhookSettings(): Promise<readonly WebhookSetting[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('webhook_settings')
    .select('webhook_id,name,url,token,is_active,updated_at');

  if (error) {
    throw new Error(`Falha ao buscar configurações de webhooks: ${error.message}`);
  }

  const rows = (data ?? []) as WebhookSettingRow[];
  return rows.map(mapWebhookSettingRow);
}

export async function upsertWebhookSetting(input: {
  readonly webhookId: string;
  readonly isActive: boolean;
  readonly name?: string | null;
  readonly url?: string | null;
  readonly token?: string | null;
}): Promise<WebhookSetting> {
  const client = getServiceClient();

  const payload = {
    webhook_id: input.webhookId,
    is_active: input.isActive,
    name: normalizeOptionalString(input.name),
    url: normalizeOptionalString(input.url),
    token: normalizeOptionalString(input.token),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await client
    .from('webhook_settings')
    .upsert(payload, { onConflict: 'webhook_id' })
    .select('webhook_id,name,url,token,is_active,updated_at')
    .single();

  if (error) {
    throw new Error(`Falha ao salvar configuração do webhook: ${error.message}`);
  }

  return mapWebhookSettingRow(data as WebhookSettingRow);
}

export function mapWebhookSettingsById(settings: readonly WebhookSetting[]): Map<string, WebhookSetting> {
  return new Map(settings.map(setting => [setting.webhookId, setting] as const));
}

function mapWebhookSettingRow(row: WebhookSettingRow): WebhookSetting {
  return {
    webhookId: row.webhook_id,
    name: row.name,
    url: row.url,
    token: row.token,
    isActive: Boolean(row.is_active),
    updatedAt: row.updated_at
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

