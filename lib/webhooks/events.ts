import { createHmac, timingSafeEqual } from 'node:crypto';

import { getServiceClient } from '@/lib/supabase';
import { listWebhookSettings, type WebhookSetting } from '@/lib/webhooks/settings';
import { normalizeWebhookTriggers, type WebhookTrigger } from '@/lib/webhooks/triggers';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export interface WebhookEventRow {
  readonly id: string;
  readonly eventId: string | null;
  readonly trigger: string | null;
  readonly status: string | null;
  readonly source: string | null;
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
  readonly webhookId: string | null;
  readonly source: string | null;
  readonly webhookToken: string | null;
  readonly signature: string | null;
  readonly signatureAlgorithm: string | null;
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

const WEBHOOK_SIGNATURE_HEADER_CANDIDATES = [
  'x-kiwify-signature',
  'x-kiwify-webhook-signature',
  'x-kiwify-signature-sha256',
  'x-webhook-signature',
  'x-webhook-signature-sha256',
  'signature'
] as const;

const WEBHOOK_ID_HEADER_CANDIDATES = [
  'x-kiwify-webhook-id',
  'x-webhook-id'
] as const;

type SupportedSignatureAlgorithm = 'sha256' | 'sha1' | 'sha512';

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
        webhook_token: normalizeString(input.webhookToken),
        headers,
        payload,
        occurred_at: occurredAt,
        received_at: receivedAt
      },
      { onConflict: 'event_id' }
    )
    .select('id,event_id,trigger,status,source,webhook_token,headers,payload,occurred_at,received_at')
    .single();

  if (error) {
    throw error;
  }

  return mapWebhookEventRow(data!);
}

export interface VerifyIncomingWebhookSignatureResult {
  readonly signature: string | null;
  readonly algorithm: string | null;
  readonly token: string | null;
  readonly webhookId: string | null;
  readonly verified: boolean;
}

export async function verifyIncomingWebhookSignature(options: {
  readonly rawBody: string | null;
  readonly signature: string | null;
  readonly signatureAlgorithm: string | null;
  readonly webhookToken?: string | null;
  readonly webhookId?: string | null;
  readonly settings?: readonly WebhookSetting[];
}): Promise<VerifyIncomingWebhookSignatureResult> {
  const signatureValue = normalizeSignatureString(options.signature);
  const algorithm = normalizeSignatureAlgorithm(options.signatureAlgorithm);
  const rawBody = typeof options.rawBody === 'string' ? options.rawBody : '';

  if (!signatureValue || !rawBody) {
    return {
      signature: signatureValue,
      algorithm,
      token: null,
      webhookId: null,
      verified: false
    };
  }

  if (!algorithm) {
    return {
      signature: signatureValue,
      algorithm: null,
      token: null,
      webhookId: null,
      verified: false
    };
  }

  const settings = options.settings ?? (await listWebhookSettings().catch(() => []));
  const activeSettings = settings.filter(setting => setting.isActive);
  const settingsById = new Map(activeSettings.map(setting => [setting.webhookId, setting]));

  const candidates: { token: string; webhookId: string | null }[] = [];

  function addCandidate(token: string | null, webhookId: string | null) {
    const normalizedToken = normalizeString(token);
    if (!normalizedToken) {
      return;
    }
    const existingIndex = candidates.findIndex(candidate => candidate.token === normalizedToken);
    if (existingIndex >= 0) {
      if (!candidates[existingIndex]!.webhookId && webhookId) {
        candidates[existingIndex] = { token: normalizedToken, webhookId };
      }
      return;
    }
    candidates.push({ token: normalizedToken, webhookId });
  }

  if (options.webhookId) {
    const normalizedWebhookId = normalizeString(options.webhookId);
    if (normalizedWebhookId) {
      const setting = settingsById.get(normalizedWebhookId);
      if (setting?.token) {
        addCandidate(setting.token, setting.webhookId);
      }
    }
  }

  if (options.webhookToken) {
    const normalizedToken = normalizeString(options.webhookToken);
    if (normalizedToken) {
      const webhookIdFromToken = findWebhookIdByToken(activeSettings, normalizedToken);
      addCandidate(normalizedToken, webhookIdFromToken ?? normalizeString(options.webhookId));
    }
  }

  for (const setting of activeSettings) {
    addCandidate(setting.token, setting.webhookId);
  }

  for (const candidate of candidates) {
    if (verifySignatureWithToken(rawBody, signatureValue, algorithm, candidate.token)) {
      const resolvedWebhookId = candidate.webhookId ?? findWebhookIdByToken(activeSettings, candidate.token);
      return {
        signature: signatureValue,
        algorithm,
        token: candidate.token,
        webhookId: resolvedWebhookId ?? null,
        verified: true
      };
    }
  }

  return {
    signature: signatureValue,
    algorithm,
    token: null,
    webhookId: null,
    verified: false
  };
}

export function resolveIncomingWebhookEvent(options: {
  readonly payload: unknown;
  readonly headers?: Headers | Record<string, string>;
  readonly receivedAt?: Date | string;
}): IncomingWebhookEvent {
  const receivedAt = normalizeDate(options.receivedAt) ?? new Date().toISOString();
  const payload = sanitizeJsonValue(options.payload ?? {});
  const headers = collectRelevantHeaders(options.headers);
  const signatureInfo = extractWebhookSignature(headers);

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
    webhookId,
    source,
    webhookToken,
    signature: signatureInfo.signature,
    signatureAlgorithm: signatureInfo.algorithm,
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
    webhookToken: normalizeString(row.webhook_token),
    headers: sanitizeHeaders(row.headers as Record<string, string> | undefined),
    payload: sanitizeJsonValue(row.payload),
    occurredAt: normalizeDate(row.occurred_at),
    receivedAt: normalizeDate(row.received_at) ?? new Date().toISOString()
  };
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

function extractWebhookId(headers: Record<string, string>, payload: JsonValue): string | null {
  const fromHeaders = extractFirstString(
    WEBHOOK_ID_HEADER_CANDIDATES.map(candidate => headers[candidate])
  );
  if (fromHeaders) {
    return fromHeaders;
  }

  const fromPayload = extractFirstString([
    getNestedString(payload, ['webhook', 'id']),
    getNestedString(payload, ['webhook_id']),
    getNestedString(payload, ['webhook', 'webhook_id']),
    getNestedString(payload, ['data', 'webhook_id']),
    getNestedString(payload, ['payload', 'webhook_id'])
  ]);

  return fromPayload;
}

interface WebhookSignatureMetadata {
  readonly raw: string | null;
  readonly signature: string | null;
  readonly algorithm: string | null;
}

function extractWebhookSignature(headers: Record<string, string>): WebhookSignatureMetadata {
  for (const candidate of WEBHOOK_SIGNATURE_HEADER_CANDIDATES) {
    const raw = headers[candidate];
    if (!raw) {
      continue;
    }
    const parsed = parseSignatureHeader(raw);
    if (parsed) {
      return {
        raw,
        signature: parsed.signature,
        algorithm: parsed.algorithm
      };
    }
    const normalized = normalizeSignatureString(raw);
    if (normalized) {
      return { raw, signature: normalized, algorithm: null };
    }
  }

  return { raw: null, signature: null, algorithm: null };
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

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (['true', 't', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', 'f', '0', 'no'].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
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

function findWebhookIdByToken(
  settings: readonly { webhookId: string; token: string | null }[],
  token: string
): string | null {
  for (const setting of settings) {
    if (setting.token && setting.token === token) {
      return setting.webhookId;
    }
  }
  return null;
}

function verifySignatureWithToken(
  rawBody: string,
  signature: string,
  algorithm: SupportedSignatureAlgorithm,
  token: string
): boolean {
  try {
    const hmac = createHmac(algorithm, token);
    hmac.update(rawBody, 'utf8');
    const digestBuffer = hmac.digest();
    const signatureFormat = detectSignatureFormat(signature);

    const digestHex = digestBuffer.toString('hex');
    const digestBase64 = digestBuffer.toString('base64');

    if (signatureFormat === 'hex') {
      return timingSafeCompare(digestHex, signature.toLowerCase());
    }

    if (signatureFormat === 'base64') {
      return timingSafeCompare(digestBase64, signature);
    }

    return (
      timingSafeCompare(digestHex, signature.toLowerCase()) ||
      timingSafeCompare(digestBase64, signature)
    );
  } catch (error) {
    console.error('verify_webhook_signature_failed', error);
    return false;
  }
}

function detectSignatureFormat(signature: string): 'hex' | 'base64' | null {
  const trimmed = signature.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return 'hex';
  }

  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return 'base64';
  }

  return null;
}

function normalizeSignatureString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSignatureAlgorithm(value: string | null | undefined): SupportedSignatureAlgorithm | null {
  if (typeof value !== 'string') {
    return 'sha256';
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return 'sha256';
  }

  if (normalized === 'sha256' || normalized === 'hmac-sha256') {
    return 'sha256';
  }
  if (normalized === 'sha1' || normalized === 'hmac-sha1') {
    return 'sha1';
  }
  if (normalized === 'sha512' || normalized === 'hmac-sha512') {
    return 'sha512';
  }

  return null;
}

function timingSafeCompare(expected: string, provided: string): boolean {
  if (typeof expected !== 'string' || typeof provided !== 'string') {
    return false;
  }

  const normalizedExpected = expected;
  const normalizedProvided = provided;

  if (normalizedExpected.length !== normalizedProvided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(normalizedExpected, 'utf8'), Buffer.from(normalizedProvided, 'utf8'));
}

interface ParsedSignatureHeader {
  readonly signature: string;
  readonly algorithm: string | null;
}

function parseSignatureHeader(raw: string): ParsedSignatureHeader | null {
  const normalizedRaw = normalizeSignatureString(raw);
  if (!normalizedRaw) {
    return null;
  }

  const segments = normalizedRaw
    .split(',')
    .map(segment => segment.trim())
    .filter(Boolean);

  let signature: string | null = null;
  let algorithm: string | null = null;

  for (const segment of segments) {
    const equalsIndex = segment.indexOf('=');
    if (equalsIndex === -1) {
      if (!signature) {
        signature = segment;
      }
      continue;
    }

    const key = segment.slice(0, equalsIndex).trim().toLowerCase();
    const value = segment.slice(equalsIndex + 1).trim();
    if (!value) {
      continue;
    }

    if (key === 't' || key === 'timestamp') {
      continue;
    }

    if (key === 'signature' || key === 'v1') {
      signature = value;
      if (!algorithm) {
        algorithm = 'sha256';
      }
      continue;
    }

    if (key.startsWith('sha') || key.startsWith('hmac-sha')) {
      const normalizedKey = key.startsWith('hmac-') ? key.slice(5) : key;
      algorithm = normalizedKey;
      signature = value;
      continue;
    }

    if (!signature) {
      signature = value;
    }
  }

  if (!signature && segments.length === 1) {
    const segment = segments[0]!;
    const equalsIndex = segment.indexOf('=');
    if (equalsIndex > 0) {
      const key = segment.slice(0, equalsIndex).trim().toLowerCase();
      const value = segment.slice(equalsIndex + 1).trim();
      if (value) {
        signature = value;
        algorithm = key.startsWith('hmac-') ? key.slice(5) : key;
      }
    } else {
      signature = segment;
    }
  }

  if (!signature) {
    return null;
  }

  return {
    signature,
    algorithm
  };
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

