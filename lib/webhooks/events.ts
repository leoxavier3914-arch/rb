import { getServiceClient } from '@/lib/supabase';
import { normalizeWebhookTriggers, type WebhookTrigger } from '@/lib/webhooks/triggers';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export interface WebhookEventRow {
  readonly id: string;
  readonly eventId: string | null;
  readonly trigger: string | null;
  readonly status: string | null;
  readonly source: string | null;
  readonly webhookId: string | null;
  readonly webhookToken: string | null;
  readonly headers: Record<string, string>;
  readonly payload: JsonValue;
  readonly occurredAt: string | null;
  readonly receivedAt: string;
}

export interface WebhookEventsPage {
  readonly items: readonly WebhookEventRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface ListWebhookEventsOptions {
  readonly page?: number;
  readonly pageSize?: number;
  readonly trigger?: string | null;
  readonly search?: string | null;
  readonly webhookToken?: string | null;
}

export interface StoreWebhookEventInput {
  readonly eventId?: string | null;
  readonly trigger?: string | null;
  readonly status?: string | null;
  readonly source?: string | null;
  readonly webhookId?: string | null;
  readonly webhookToken?: string | null;
  readonly headers?: Record<string, string>;
  readonly payload: JsonValue;
  readonly occurredAt?: string | null;
  readonly receivedAt?: string | null;
}

export interface IncomingWebhookEvent {
  readonly eventId: string | null;
  readonly trigger: string | null;
  readonly status: string | null;
  readonly source: string | null;
  readonly webhookId: string | null;
  readonly webhookToken: string | null;
  readonly headers: Record<string, string>;
  readonly payload: JsonValue;
  readonly occurredAt: string | null;
  readonly receivedAt: string;
}

const DEFAULT_PAGE_SIZE = 10;

const WEBHOOK_TOKEN_HEADER_CANDIDATES = [
  'x-kiwify-webhook-token',
  'x-kiwify-webhook-secret',
  'x-kiwify-token',
  'x-kiwify-secret',
  'x-webhook-token',
  'x-webhook-secret'
] as const;

const WEBHOOK_ID_HEADER_CANDIDATES = [
  'x-kiwify-webhook-id',
  'x-kiwify-webhook',
  'x-webhook-id'
] as const;

export async function listWebhookEvents(options: ListWebhookEventsOptions = {}): Promise<WebhookEventsPage> {
  const client = getServiceClient();
  const page = normalizePositiveInteger(options.page, 1);
  const pageSize = normalizePositiveInteger(options.pageSize, DEFAULT_PAGE_SIZE);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('webhook_events')
    .select(
      `
        id,
        event_id,
        trigger,
        status,
        source,
        webhook_id,
        webhook_token,
        headers,
        payload,
        occurred_at,
        received_at
      `,
      { count: 'exact' }
    )
    .order('received_at', { ascending: false, nullsFirst: false });

  const trigger = normalizeString(options.trigger);
  if (trigger) {
    query = query.eq('trigger', trigger);
  }

  if (options.webhookToken !== undefined) {
    if (options.webhookToken === null) {
      query = query.is('webhook_token', null);
    } else {
      const webhookToken = normalizeString(options.webhookToken);
      if (webhookToken) {
        query = query.eq('webhook_token', webhookToken);
      } else {
        query = query.is('webhook_token', null);
      }
    }
  }

  const search = normalizeString(options.search);
  if (search) {
    const escaped = escapeForILike(search);
    const pattern = `%${escaped}%`;
    query = query.or(
      [
        `event_id.ilike.${pattern}`,
        `status.ilike.${pattern}`,
        `source.ilike.${pattern}`
      ].join(',')
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  const rows = (data ?? []).map(mapWebhookEventRow);

  return {
    items: rows,
    total: typeof count === 'number' ? count : 0,
    page,
    pageSize
  };
}

export async function storeWebhookEvent(input: StoreWebhookEventInput): Promise<WebhookEventRow> {
  const client = getServiceClient();
  const payload = sanitizeJsonValue(input.payload);
  const headers = sanitizeHeaders(input.headers ?? {});
  const occurredAt = normalizeDate(input.occurredAt);
  const receivedAt = normalizeDate(input.receivedAt) ?? new Date().toISOString();

  const { data, error } = await client
    .from('webhook_events')
    .upsert(
      {
        event_id: normalizeString(input.eventId),
        trigger: normalizeString(coerceTrigger(input.trigger)),
        status: normalizeString(input.status),
        source: normalizeString(input.source),
        webhook_id: normalizeString(input.webhookId),
        webhook_token: normalizeString(input.webhookToken),
        headers,
        payload,
        occurred_at: occurredAt,
        received_at: receivedAt
      },
      { onConflict: 'event_id' }
    )
    .select('id,event_id,trigger,status,source,webhook_id,webhook_token,headers,payload,occurred_at,received_at')
    .single();

  if (error) {
    throw error;
  }

  return mapWebhookEventRow(data!);
}

export function resolveIncomingWebhookEvent(options: {
  readonly payload: unknown;
  readonly headers?: Headers | Record<string, string>;
  readonly receivedAt?: Date | string;
}): IncomingWebhookEvent {
  const receivedAt = normalizeDate(options.receivedAt) ?? new Date().toISOString();
  const payload = sanitizeJsonValue(options.payload ?? {});
  const headers = collectRelevantHeaders(options.headers);

  const rawTrigger = extractFirstString([
    headers['x-kiwify-event'],
    headers['x-kiwify-trigger'],
    getNestedString(payload, ['trigger']),
    getNestedString(payload, ['event']),
    getNestedString(payload, ['type']),
    getNestedString(payload, ['data', 'trigger']),
    getNestedString(payload, ['payload', 'trigger'])
  ]);

  const trigger = coerceTrigger(rawTrigger) ?? rawTrigger;

  const status = extractFirstString([
    getNestedString(payload, ['status']),
    getNestedString(payload, ['data', 'status']),
    getNestedString(payload, ['order', 'status']),
    getNestedString(payload, ['subscription', 'status']),
    getNestedString(payload, ['payment', 'status']),
    getNestedString(payload, ['payload', 'status'])
  ]);

  const eventId = extractFirstString([
    headers['x-kiwify-event-id'],
    headers['x-kiwify-delivery-id'],
    headers['x-request-id'],
    getNestedString(payload, ['id']),
    getNestedString(payload, ['event_id']),
    getNestedString(payload, ['eventId']),
    getNestedString(payload, ['data', 'id']),
    getNestedString(payload, ['order', 'id']),
    getNestedString(payload, ['payload', 'id'])
  ]);

  const source = extractFirstString([
    headers['x-kiwify-account-id'],
    headers['user-agent'],
    getNestedString(payload, ['account_id']),
    getNestedString(payload, ['accountId']),
    getNestedString(payload, ['store', 'id']),
    getNestedString(payload, ['payload', 'account_id'])
  ]);

  const webhookId = extractWebhookId(headers, payload);
  const webhookToken = extractWebhookToken(headers, payload);

  const occurredAt =
    extractFirstDate([
      getNestedValue(payload, ['occurred_at']),
      getNestedValue(payload, ['occurredAt']),
      getNestedValue(payload, ['created_at']),
      getNestedValue(payload, ['createdAt']),
      getNestedValue(payload, ['data', 'created_at']),
      getNestedValue(payload, ['data', 'createdAt']),
      getNestedValue(payload, ['order', 'created_at']),
      getNestedValue(payload, ['order', 'createdAt']),
      getNestedValue(payload, ['subscription', 'created_at']),
      getNestedValue(payload, ['subscription', 'updated_at']),
      getNestedValue(payload, ['payment', 'charge_at']),
      getNestedValue(payload, ['payload', 'created_at'])
    ]) ?? null;

  return {
    eventId,
    trigger,
    status,
    source,
    webhookId,
    webhookToken,
    headers,
    payload,
    occurredAt,
    receivedAt
  };
}

function mapWebhookEventRow(row: Record<string, unknown>): WebhookEventRow {
  return {
    id: String(row.id),
    eventId: normalizeString(row.event_id) ?? null,
    trigger: normalizeString(row.trigger),
    status: normalizeString(row.status),
    source: normalizeString(row.source),
    webhookId: normalizeString(row.webhook_id),
    webhookToken: normalizeString(row.webhook_token),
    headers: sanitizeHeaders(row.headers as Record<string, string> | undefined),
    payload: sanitizeJsonValue(row.payload),
    occurredAt: normalizeDate(row.occurred_at),
    receivedAt: normalizeDate(row.received_at) ?? new Date().toISOString()
  };
}

function extractWebhookId(headers: Record<string, string>, payload: JsonValue): string | null {
  const fromHeaders = extractFirstString(WEBHOOK_ID_HEADER_CANDIDATES.map(candidate => headers[candidate]));
  if (fromHeaders) {
    return fromHeaders;
  }

  const fromPayload = extractFirstString([
    getNestedString(payload, ['webhook', 'id']),
    getNestedString(payload, ['webhook', 'webhook_id']),
    getNestedString(payload, ['webhook', 'webhookId']),
    getNestedString(payload, ['webhook_id']),
    getNestedString(payload, ['webhookId']),
    getNestedString(payload, ['data', 'webhook_id']),
    getNestedString(payload, ['data', 'webhookId']),
    getNestedString(payload, ['payload', 'webhook_id']),
    getNestedString(payload, ['payload', 'webhookId'])
  ]);

  return fromPayload;
}

function sanitizeJsonValue(value: unknown): JsonValue {
  if (value === null || value === undefined) {
    return {};
  }
  if (value instanceof Date) {
    return toIsoString(value) ?? new Date(value).toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString(10);
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeJsonValue(item));
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const output: Record<string, JsonValue> = {};
    for (const [key, raw] of Object.entries(source)) {
      if (raw === undefined) {
        continue;
      }
      output[key] = sanitizeJsonValue(raw);
    }
    return output;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch (error) {
    return {};
  }
}

function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const name = key.trim().toLowerCase();
    if (!name) {
      continue;
    }
    const trimmedValue = typeof value === 'string' ? value.trim() : '';
    if (!trimmedValue) {
      continue;
    }
    normalized[name] = trimmedValue;
  }
  return normalized;
}

function extractWebhookToken(headers: Record<string, string>, payload: JsonValue): string | null {
  const fromHeaders = extractFirstString(
    WEBHOOK_TOKEN_HEADER_CANDIDATES.map(candidate => headers[candidate])
  );
  if (fromHeaders) {
    return fromHeaders;
  }

  const payloadToken = extractFirstString([
    getNestedString(payload, ['webhook', 'token']),
    getNestedString(payload, ['webhook', 'secret']),
    getNestedString(payload, ['token']),
    getNestedString(payload, ['secret']),
    getNestedString(payload, ['data', 'token']),
    getNestedString(payload, ['data', 'secret']),
    getNestedString(payload, ['payload', 'token']),
    getNestedString(payload, ['payload', 'secret'])
  ]);

  return payloadToken;
}

function collectRelevantHeaders(headers?: Headers | Record<string, string>): Record<string, string> {
  if (!headers) {
    return {};
  }

  const allowed = new Set([
    'content-type',
    'content-length',
    'user-agent',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-request-id',
    'x-vercel-id',
    'x-vercel-ip-country',
    'x-vercel-ip-city',
    'x-vercel-ip',
    'x-real-ip'
  ]);

  const collected: Record<string, string> = {};

  const iterate = headers instanceof Headers ? headers.entries() : Object.entries(headers);

  for (const [keyRaw, valueRaw] of iterate) {
    const key = keyRaw.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const isKiwifyHeader = key.startsWith('x-kiwify-');
    const isWebhookHeader = key.startsWith('x-webhook-');
    if (!isKiwifyHeader && !isWebhookHeader && !allowed.has(key)) {
      continue;
    }
    const value = typeof valueRaw === 'string' ? valueRaw.trim() : '';
    if (!value) {
      continue;
    }
    collected[key] = value;
  }

  return collected;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.floor(value);
    if (rounded > 0) {
      return rounded;
    }
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function escapeForILike(value: string): string {
  return value.replace(/[%_]/g, character => `\\${character}`);
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && trimmed === numeric.toString()) {
      return fromEpochNumber(numeric);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return fromEpochNumber(value);
  }
  if (typeof value === 'bigint') {
    return fromEpochNumber(Number(value));
  }
  return null;
}

function fromEpochNumber(value: number): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  const length = Math.trunc(Math.abs(value)).toString().length;
  if (length >= 16) {
    return null;
  }

  // assume seconds when length <= 10 otherwise milliseconds
  const date = new Date(length <= 10 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toIsoString(value: Date): string | null {
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function extractFirstString(candidates: Iterable<unknown>): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeString(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function extractFirstDate(candidates: Iterable<unknown>): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeDate(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function coerceTrigger(value: unknown): string | null {
  const normalized = normalizeWebhookTrigger(value);
  if (normalized) {
    return normalized;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function normalizeWebhookTrigger(value: unknown): WebhookTrigger | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = normalizeWebhookTriggers([value]);
  return normalized.length > 0 ? normalized[0]! : null;
}

function getNestedValue(source: JsonValue, path: readonly string[]): unknown {
  if (!source || typeof source !== 'object') {
    return null;
  }

  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    const record = current as Record<string, unknown>;
    current = record[key];
  }
  return current;
}

function getNestedString(source: JsonValue, path: readonly string[]): string | null {
  const value = getNestedValue(source, path);
  return normalizeString(value);
}

