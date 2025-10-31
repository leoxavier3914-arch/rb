import { createKiwifyClient, type KiwifyClient } from '@/lib/kiwify/client';

interface UnknownRecord {
  readonly [key: string]: unknown;
}

export interface BalanceInfo {
  readonly availableCents: number;
  readonly pendingCents: number;
  readonly legalEntityId: string | null;
}

export interface PayoutItem {
  readonly id: string;
  readonly amountCents: number;
  readonly status: string;
  readonly legalEntityId: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

export interface PayoutList {
  readonly items: readonly PayoutItem[];
  readonly count: number;
  readonly pageNumber: number;
  readonly pageSize: number;
}

export interface CreatePayoutResult {
  readonly id: string;
}

async function ensureClient(client?: KiwifyClient): Promise<KiwifyClient> {
  if (client) {
    return client;
  }
  return createKiwifyClient();
}

export async function getBalance(client?: KiwifyClient): Promise<BalanceInfo> {
  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request('/balance');

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Falha ao buscar saldo na Kiwify: ${response.status} ${body.slice(0, 120)}`);
  }

  const payload = (await response.json().catch(() => ({}))) as UnknownRecord;
  return {
    availableCents: toPositiveNumber(payload.available) ?? 0,
    pendingCents: toPositiveNumber(payload.pending) ?? 0,
    legalEntityId: toNullableString(payload.legal_entity_id)
  };
}

export async function listPayouts(client?: KiwifyClient): Promise<PayoutList> {
  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request('/payouts');

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Falha ao listar saques na Kiwify: ${response.status} ${body.slice(0, 120)}`);
  }

  const payload = (await response.json().catch(() => null)) as UnknownRecord | null;
  if (!payload) {
    return { items: [], count: 0, pageNumber: 1, pageSize: 0 };
  }

  const pagination = isRecord(payload.pagination) ? payload.pagination : null;
  const pageNumber = toPositiveNumber(pagination?.page_number) ?? 1;
  const pageSize = toPositiveNumber(pagination?.page_size) ?? 0;
  const count = toPositiveNumber(pagination?.count ?? payload.count) ?? 0;

  const items = extractArray(payload.data).map(parsePayout).filter((item): item is PayoutItem => item !== null);

  return {
    items,
    count,
    pageNumber,
    pageSize
  };
}

export async function createPayout(amountCents: number, client?: KiwifyClient): Promise<CreatePayoutResult> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error('Valor do saque inválido.');
  }

  const resolvedClient = await ensureClient(client);
  const response = await resolvedClient.request('/payouts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ amount: Math.round(amountCents) })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Falha ao solicitar saque na Kiwify: ${response.status} ${body.slice(0, 120)}`);
  }

  const payload = (await response.json().catch(() => null)) as UnknownRecord | null;
  const id = toNullableString(payload?.id);
  if (!id) {
    throw new Error('Resposta inválida ao criar saque.');
  }

  return { id };
}

function parsePayout(payload: UnknownRecord): PayoutItem | null {
  const id = toNullableString(payload.id);
  const amountCents = toPositiveNumber(payload.amount);
  if (!id || amountCents === null) {
    return null;
  }

  return {
    id,
    amountCents,
    status: toNullableString(payload.status) ?? 'unknown',
    legalEntityId: toNullableString(payload.legal_entity_id),
    createdAt: toIso(payload.created_at ?? payload.createdAt ?? null),
    updatedAt: toIso(payload.updated_at ?? payload.updatedAt ?? null)
  };
}

function extractArray(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
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

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
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
