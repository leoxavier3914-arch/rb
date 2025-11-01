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

const GLOBAL_PRODUCTS_SCOPE = 'all';
const GLOBAL_PRODUCTS_API_VALUE = 'all_products';

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
  const requestBody = buildWebhookRequestPayload(input, 'create');
  if (!requestBody) {
    throw new Error('Falha ao preparar os dados para criar o webhook.');
  }

  const resolvedClient = await ensureClient(client);

  const response = await resolvedClient.request('/webhooks', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestBody)
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

  const body = buildWebhookRequestPayload(input, 'update');
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

function buildWebhookRequestPayload(
  input: CreateWebhookInput | UpdateWebhookInput,
  mode: 'create' | 'update'
): UnknownRecord | null {
  const payload: Record<string, unknown> = {};

  if (mode === 'create' || hasOwn(input, 'url')) {
    const url = normalizeUrl((input as UpdateWebhookInput).url);
    if (!url) {
      throw new Error('Informe uma URL válida para o webhook.');
    }
    payload.url = url;
  }

  if (mode === 'create' || hasOwn(input, 'triggers')) {
    const triggers = normalizeTriggers((input as UpdateWebhookInput).triggers);
    if (triggers.length === 0) {
      throw new Error('Selecione ao menos um gatilho para o webhook.');
    }
    payload.triggers = triggers;
  }

  if (hasOwn(input, 'name')) {
    const rawName = (input as UpdateWebhookInput).name;
    if (rawName === undefined) {
      // No-op: treat explicit undefined the same as omitted.
    } else if (rawName === null) {
      if (mode === 'update') {
        payload.name = null;
      }
    } else if (typeof rawName === 'string') {
      const name = normalizeOptionalString(rawName);
      if (name) {
        payload.name = name;
      } else if (mode === 'update') {
        payload.name = null;
      }
    } else {
      throw new Error('Informe um nome válido para o webhook.');
    }
  }

  if (hasOwn(input, 'products')) {
    const rawProducts = (input as UpdateWebhookInput).products;
    if (rawProducts === undefined) {
      // No-op: treat explicit undefined the same as omitted.
    } else {
      const normalizedProducts =
        rawProducts === null ? null : normalizeProducts(rawProducts);
      const products = mapProductsToApi(normalizedProducts);
      if (products === undefined) {
        throw new Error('Informe um escopo de produtos válido para o webhook.');
      }
      payload.products = products;
    }
  }

  if (hasOwn(input, 'token')) {
    const rawToken = (input as UpdateWebhookInput).token;
    if (rawToken === undefined) {
      // No-op: treat explicit undefined the same as omitted.
    } else if (rawToken === null) {
      if (mode === 'update') {
        payload.token = null;
      }
    } else if (typeof rawToken === 'string') {
      const token = normalizeOptionalString(rawToken);
      if (token) {
        payload.token = token;
      } else if (mode === 'update') {
        payload.token = null;
      }
    } else {
      throw new Error('Informe um token válido para o webhook.');
    }
  }

  if (mode === 'update') {
    return Object.keys(payload).length > 0 ? payload : null;
  }

  return payload;
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
    products: parseProductsFromApi(payload.products),
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

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
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

function normalizeProducts(value: unknown): string {
  if (value === null) {
    return GLOBAL_PRODUCTS_SCOPE;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return GLOBAL_PRODUCTS_SCOPE;
    }
    const lowerCased = trimmed.toLowerCase();
    if (lowerCased === GLOBAL_PRODUCTS_SCOPE || lowerCased === GLOBAL_PRODUCTS_API_VALUE) {
      return GLOBAL_PRODUCTS_SCOPE;
    }
    return trimmed;
  }

  throw new Error('Informe um escopo de produtos válido para o webhook.');
}

function mapProductsToApi(value: string | null | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return GLOBAL_PRODUCTS_API_VALUE;
  }

  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (normalized === GLOBAL_PRODUCTS_SCOPE || normalized === GLOBAL_PRODUCTS_API_VALUE) {
    return GLOBAL_PRODUCTS_API_VALUE;
  }

  return trimmed;
}

function parseProductsFromApi(value: unknown): string | null {
  const normalized = toNullableString(value);
  if (!normalized) {
    return null;
  }

  const lowerCased = normalized.toLowerCase();
  if (lowerCased === GLOBAL_PRODUCTS_SCOPE || lowerCased === GLOBAL_PRODUCTS_API_VALUE) {
    return GLOBAL_PRODUCTS_SCOPE;
  }

  return normalized;
}
