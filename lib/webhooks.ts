import { createKiwifyClient, type KiwifyClient } from '@/lib/kiwify/client';

interface UnknownRecord {
  readonly [key: string]: unknown;
}

export interface Webhook {
  readonly id: string;
  readonly url: string;
  readonly status: string;
  readonly events: readonly string[];
  readonly secret: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

export interface CreateWebhookInput {
  readonly url: string;
  readonly events: readonly string[];
  readonly status?: string;
  readonly secret?: string | null;
}

export interface UpdateWebhookInput {
  readonly url?: string;
  readonly events?: readonly string[];
  readonly status?: string;
  readonly secret?: string | null;
}

async function ensureClient(client?: KiwifyClient): Promise<KiwifyClient> {
  if (client) {
    return client;
  }
  return createKiwifyClient();
}

export async function listWebhooks(client?: KiwifyClient): Promise<readonly Webhook[]> {
  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request('/webhooks');

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Falha ao listar webhooks na Kiwify: ${response.status} ${body.slice(0, 120)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const records = extractWebhookRecords(payload);

  return records
    .map(parseWebhook)
    .filter((item): item is Webhook => item !== null);
}

export async function createWebhook(input: CreateWebhookInput, client?: KiwifyClient): Promise<Webhook> {
  const url = normalizeUrl(input.url);
  if (!url) {
    throw new Error('Informe uma URL válida para o webhook.');
  }

  const events = normalizeEvents(input.events);
  if (events.length === 0) {
    throw new Error('Selecione ao menos um evento para o webhook.');
  }

  const status = normalizeStatus(input.status) ?? 'active';
  const secret = normalizeOptionalString(input.secret);

  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request('/webhooks', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ url, events, status, ...(secret ? { secret } : {}) })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Falha ao criar webhook na Kiwify: ${response.status} ${body.slice(0, 120)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const record = extractWebhookRecord(payload);
  const webhook = record ? parseWebhook(record) : null;

  if (!webhook) {
    throw new Error('Resposta inválida ao criar webhook.');
  }

  return webhook;
}

export async function updateWebhook(
  id: string,
  input: UpdateWebhookInput,
  client?: KiwifyClient
): Promise<Webhook> {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    throw new Error('Informe o identificador do webhook a ser atualizado.');
  }

  const body = buildUpdatePayload(input);
  if (!body) {
    throw new Error('Nenhum dado informado para atualizar o webhook.');
  }

  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request(`/webhooks/${encodeURIComponent(normalizedId)}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(`Falha ao atualizar webhook na Kiwify: ${response.status} ${responseBody.slice(0, 120)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const record = extractWebhookRecord(payload);
  const webhook = record ? parseWebhook(record) : null;

  if (!webhook) {
    throw new Error('Resposta inválida ao atualizar webhook.');
  }

  return webhook;
}

export async function deleteWebhook(id: string, client?: KiwifyClient): Promise<void> {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    throw new Error('Informe o identificador do webhook a ser excluído.');
  }

  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request(`/webhooks/${encodeURIComponent(normalizedId)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Falha ao excluir webhook na Kiwify: ${response.status} ${body.slice(0, 120)}`);
  }
}

function buildUpdatePayload(input: UpdateWebhookInput): UnknownRecord | null {
  const payload: Record<string, unknown> = {};

  const url = input.url !== undefined ? normalizeUrl(input.url) : undefined;
  if (url) {
    payload.url = url;
  } else if (input.url !== undefined && !url) {
    throw new Error('Informe uma URL válida para o webhook.');
  }

  if (input.events !== undefined) {
    const events = normalizeEvents(input.events);
    if (events.length === 0) {
      throw new Error('Selecione ao menos um evento para o webhook.');
    }
    payload.events = events;
  }

  if (input.status !== undefined) {
    const status = normalizeStatus(input.status);
    if (!status) {
      throw new Error('Status inválido informado para o webhook.');
    }
    payload.status = status;
  }

  if (input.secret !== undefined) {
    const secret = normalizeOptionalString(input.secret);
    if (secret) {
      payload.secret = secret;
    } else if (input.secret) {
      throw new Error('Informe um segredo válido para o webhook.');
    }
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function extractWebhookRecords(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (isRecord(payload)) {
    if (Array.isArray(payload.data)) {
      return payload.data.filter(isRecord);
    }
    if (Array.isArray(payload.items)) {
      return payload.items.filter(isRecord);
    }
    if (isRecord(payload.data)) {
      return [payload.data];
    }
    return [payload];
  }

  return [];
}

function extractWebhookRecord(payload: unknown): UnknownRecord | null {
  if (isRecord(payload)) {
    if (isRecord(payload.data)) {
      return payload.data;
    }
    return payload;
  }

  const records = extractWebhookRecords(payload);
  return records[0] ?? null;
}

function parseWebhook(payload: UnknownRecord): Webhook | null {
  const id = toNullableString(payload.id);
  const url = toNullableString(payload.url);
  if (!id || !url) {
    return null;
  }

  return {
    id,
    url,
    status: toNullableString(payload.status) ?? 'inactive',
    events: extractStringArray(payload.events),
    secret: toNullableString(payload.secret),
    createdAt: toIso(payload.created_at ?? payload.createdAt ?? null),
    updatedAt: toIso(payload.updated_at ?? payload.updatedAt ?? null)
  };
}

function extractStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(toNullableString)
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return null;
}

function toIso(value: unknown): string | null {
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return null;
}

function normalizeUrl(value: unknown): string | null {
  const url = toNullableString(value);
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch (error) {
    return null;
  }
}

function normalizeEvents(events: readonly unknown[] | undefined): string[] {
  if (!events) {
    return [];
  }
  return events
    .map(toNullableString)
    .filter((item): item is string => Boolean(item))
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function normalizeStatus(status: unknown): 'active' | 'inactive' | null {
  const value = toNullableString(status);
  if (!value) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'active' || normalized === 'inactive') {
    return normalized;
  }
  return null;
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = toNullableString(value);
  return normalized ? normalized : null;
}

function normalizeId(value: unknown): string | null {
  const id = toNullableString(value);
  return id ?? null;
}
