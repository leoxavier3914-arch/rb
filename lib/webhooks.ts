import { createKiwifyClient, type KiwifyClient } from '@/lib/kiwify/client';
import { normalizeWebhookTriggers } from '@/lib/webhooks/triggers';

interface UnknownRecord {
  readonly [key: string]: unknown;
}

export interface Webhook {
  readonly id: string;
  readonly name: string | null;
  readonly url: string;
  readonly products: string | null;
  readonly triggers: readonly string[];
  readonly token: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

export interface CreateWebhookInput {
  readonly url: string;
  readonly triggers: readonly string[];
  readonly name?: string | null;
  readonly products?: string | null;
  readonly token?: string | null;
}

export interface UpdateWebhookInput {
  readonly url?: string;
  readonly triggers?: readonly string[];
  readonly name?: string | null;
  readonly products?: string | null;
  readonly token?: string | null;
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

  const triggers = normalizeTriggers(input.triggers);
  if (triggers.length === 0) {
    throw new Error('Selecione ao menos um gatilho para o webhook.');
  }

  const name = normalizeOptionalString(input.name);
  const products = normalizeProducts(input.products) ?? 'all';
  const token = normalizeOptionalString(input.token);

  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request('/webhooks', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      url,
      triggers,
      products,
      ...(name ? { name } : {}),
      ...(token ? { token } : {})
    })
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
    method: 'PUT',
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

  if (input.triggers !== undefined) {
    const triggers = normalizeTriggers(input.triggers);
    if (triggers.length === 0) {
      throw new Error('Selecione ao menos um gatilho para o webhook.');
    }
    payload.triggers = triggers;
  }

  if (input.name !== undefined) {
    if (input.name === null) {
      payload.name = null;
    } else if (typeof input.name === 'string') {
      const name = normalizeOptionalString(input.name);
      payload.name = name;
    } else {
      throw new Error('Informe um nome válido para o webhook.');
    }
  }

  if (input.products !== undefined) {
    if (input.products === null) {
      payload.products = null;
    } else if (typeof input.products === 'string') {
      const trimmed = input.products.trim();
      if (trimmed.length === 0 || trimmed.toLowerCase() === 'all') {
        // Do not include products when there is no specific product scope.
      } else {
        const products = normalizeProducts(trimmed);
        if (products) {
          payload.products = products;
        } else {
          throw new Error('Informe um escopo de produtos válido para o webhook.');
        }
      }
    } else {
      throw new Error('Informe um escopo de produtos válido para o webhook.');
    }
  }

  if (input.token !== undefined) {
    if (input.token === null) {
      payload.token = null;
    } else if (typeof input.token === 'string') {
      const token = normalizeOptionalString(input.token);
      payload.token = token;
    } else {
      throw new Error('Informe um token válido para o webhook.');
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
    name: toNullableString(payload.name),
    url,
    products: toNullableString(payload.products),
    triggers: extractStringArray(payload.triggers),
    token: toNullableString(payload.token),
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

function normalizeTriggers(triggers: readonly unknown[] | undefined): string[] {
  if (!triggers) {
    return [];
  }
  const normalized = normalizeWebhookTriggers(triggers);
  return [...normalized];
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = toNullableString(value);
  return normalized ? normalized : null;
}

function normalizeId(value: unknown): string | null {
  const id = toNullableString(value);
  return id ?? null;
}

function normalizeProducts(value: unknown): string | null {
  const products = toNullableString(value);
  return products ? products : null;
}
