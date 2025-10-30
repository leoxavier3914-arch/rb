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

/**
 * Ensure a KiwifyClient instance is available, creating a new one if none is provided.
 *
 * @returns A KiwifyClient instance (the provided client or a newly created one)
 */
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

/**
 * Create a new webhook in Kiwify using the provided input.
 *
 * @param input - Payload for creating the webhook. Must include a valid `url` and at least one `triggers` entry; may include `name`, `products`, and `token`.
 * @returns The created `Webhook` object as returned by the Kiwify API.
 * @throws Error if `url` is invalid or missing.
 * @throws Error if `triggers` is empty or invalid.
 * @throws Error if the Kiwify API responds with a non-ok status (includes status and a short response snippet).
 * @throws Error if the API response cannot be parsed into a valid webhook record.
 */
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

/**
 * Constructs an update payload for a webhook from the provided input, validating any supplied fields.
 *
 * @param input - Input whose present properties will be validated and included in the payload; passing `null` for nullable fields will include the field with `null` to unset it.
 * @returns An object containing validated fields suitable for a PATCH request, or `null` if the input contains no updatable fields.
 * @throws Error if any provided field is invalid (e.g., invalid URL, empty triggers array, or invalid name/products/token).
 */
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
    const products = normalizeProducts(input.products);
    if (products) {
      payload.products = products;
    } else if (input.products) {
      throw new Error('Informe um escopo de produtos válido para o webhook.');
    } else {
      payload.products = 'all';
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

/**
 * Parse a raw webhook record into a typed Webhook object.
 *
 * Converts and validates required fields (`id`, `url`) and maps optional fields (`name`, `products`, `triggers`, `token`, `createdAt`, `updatedAt`) to their normalized forms.
 *
 * @param payload - The raw record object to parse.
 * @returns A Webhook object when `id` and `url` are present and valid; `null` otherwise. `createdAt` and `updatedAt` are returned as ISO strings or `null` if missing or invalid; `triggers` is returned as a string array.
 */
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

/**
 * Normalizes a value into a canonical absolute URL string or returns null when it is not a valid URL.
 *
 * @param value - A value representing a URL; strings or values convertible to a string are accepted.
 * @returns `null` if `value` is not a valid URL, otherwise the URL's absolute href string.
 */
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

/**
 * Convert an optional triggers input into a normalized array of trigger strings.
 *
 * @param triggers - The raw triggers value (array or undefined) to normalize.
 * @returns An array of normalized trigger strings; empty if no valid triggers were provided.
 */
function normalizeTriggers(triggers: readonly unknown[] | undefined): string[] {
  if (!triggers) {
    return [];
  }
  const normalized = normalizeWebhookTriggers(triggers);
  return [...normalized];
}

/**
 * Normalize an unknown value to a trimmed string or null.
 *
 * @returns `string` if `value` can be converted to a non-empty trimmed string, `null` otherwise.
 */
function normalizeOptionalString(value: unknown): string | null {
  const normalized = toNullableString(value);
  return normalized ? normalized : null;
}

/**
 * Normalize an input value to an identifier.
 *
 * @param value - The value to normalize into an identifier
 * @returns The normalized identifier string, or `null` if the input cannot be converted to a non-empty identifier
 */
function normalizeId(value: unknown): string | null {
  const id = toNullableString(value);
  return id ?? null;
}

/**
 * Normalize a products value into a trimmed string or null.
 *
 * @param value - The input to normalize (may be string, number, bigint, or other)
 * @returns The trimmed string representation of `value`, or `null` if it is missing, empty, or cannot be converted
 */
function normalizeProducts(value: unknown): string | null {
  const products = toNullableString(value);
  return products ? products : null;
}