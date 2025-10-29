import { loadEnv } from '@/lib/env';
import { resolveApiUrl, resolveTokenUrl } from './baseUrl';
import { upsertSales, type UpsertSaleInput } from '@/lib/sales';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 100;

interface UnknownRecord {
  readonly [key: string]: unknown;
}

interface FetchPageParams {
  readonly token: string;
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly accountId?: string;
  readonly baseUrl?: string;
}

interface ParsedPage {
  readonly items: UnknownRecord[];
  readonly hasMore: boolean;
}

export interface SyncResult {
  readonly totalFetched: number;
  readonly batches: number;
  readonly startDate: string;
  readonly endDate: string;
}

export async function syncSalesFromKiwify(): Promise<SyncResult> {
  const env = loadEnv();
  if (!env.KIWIFY_CLIENT_ID || !env.KIWIFY_CLIENT_SECRET) {
    throw new Error('Credenciais da Kiwify não configuradas.');
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Credenciais do Supabase não configuradas.');
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 89 * DAY_IN_MS);
  const token = await fetchAccessToken(env.KIWIFY_CLIENT_ID, env.KIWIFY_CLIENT_SECRET, env.KIWIFY_API_BASE_URL);

  let pageNumber = 1;
  let batches = 0;
  let totalFetched = 0;
  const pageSize =
    typeof env.KFY_PAGE_SIZE === 'number' && Number.isFinite(env.KFY_PAGE_SIZE)
      ? Math.max(1, env.KFY_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  while (true) {
    const pageResult = await fetchSalesPage({
      token,
      pageNumber,
      pageSize,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      accountId: env.KIWIFY_ACCOUNT_ID ?? undefined,
      baseUrl: env.KIWIFY_API_BASE_URL
    });

    if (pageResult.items.length === 0) {
      break;
    }

    const rows = pageResult.items.map(mapSalePayload).filter((row): row is UpsertSaleInput => row !== null);
    if (rows.length > 0) {
      await upsertSales(rows);
      totalFetched += rows.length;
      batches += 1;
    }

    if (!pageResult.hasMore) {
      break;
    }
    pageNumber += 1;
  }

  return {
    totalFetched,
    batches,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

async function fetchAccessToken(clientId: string, clientSecret: string, baseUrl: string | undefined): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(resolveTokenUrl(baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token OAuth da Kiwify: ${response.status}`);
  }

  const payload = (await response.json()) as UnknownRecord;
  const token = typeof payload.access_token === 'string' ? payload.access_token : null;
  if (!token) {
    throw new Error('Resposta inválida ao solicitar token da Kiwify.');
  }
  return token;
}

async function fetchSalesPage(params: FetchPageParams): Promise<ParsedPage> {
  const search = new URLSearchParams({
    page_number: params.pageNumber.toString(),
    page_size: params.pageSize.toString(),
    start_date: params.startDate,
    end_date: params.endDate,
    view_full_sale_details: 'true'
  });

  const response = await fetch(resolveApiUrl(params.baseUrl, `/sales?${search.toString()}`), {
    headers: buildKiwifyHeaders(params.token, params.accountId)
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Falha ao listar vendas na Kiwify: ${response.status} ${bodyText.slice(0, 160)}`);
  }

  const payload = (await response.json().catch(() => null)) as UnknownRecord | null;
  if (!payload) {
    return { items: [], hasMore: false };
  }

  const items = extractItems(payload);
  const hasMore = computeHasMore(payload, params.pageNumber, params.pageSize, items.length);
  return { items, hasMore };
}

function buildKiwifyHeaders(token: string, accountId?: string) {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  if (accountId) {
    headers.set('x-kiwify-account-id', accountId);
  }
  return headers;
}

function extractItems(payload: UnknownRecord): UnknownRecord[] {
  const data = payload.data;
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }
  const items = payload.items;
  if (Array.isArray(items)) {
    return items.filter(isRecord);
  }
  return [];
}

function computeHasMore(
  payload: UnknownRecord,
  pageNumber: number,
  pageSize: number,
  itemCount: number
): boolean {
  const pagination = isRecord(payload.pagination) ? payload.pagination : null;
  const totalPages = toNumber(pagination?.total_pages ?? payload.total_pages ?? payload.totalPages);
  if (typeof totalPages === 'number' && totalPages >= 0) {
    return pageNumber < totalPages;
  }
  const total = toNumber(pagination?.total ?? payload.total);
  if (typeof total === 'number' && total >= 0) {
    return pageNumber * pageSize < total;
  }
  return itemCount === pageSize;
}

export function mapSalePayload(payload: UnknownRecord): UpsertSaleInput | null {
  const idRaw = payload.id ?? payload.uuid;
  if (!idRaw) {
    return null;
  }
  const id = String(idRaw);

  const product = isRecord(payload.product) ? payload.product : null;
  const customer = isRecord(payload.customer) ? payload.customer : null;
  const payment = isRecord(payload.payment) ? payload.payment : null;

  const productId = toNullableString(payload.product_id ?? product?.id);
  const productTitle = toNullableString(payload.product_title ?? product?.title ?? product?.name);
  const customerId = toNullableString(payload.customer_id ?? customer?.id);
  const customerName = toNullableString(
    payload.customer_name ?? customer?.name ?? customer?.full_name ?? customer?.fullName
  );
  const customerEmail = toNullableString(payload.customer_email ?? customer?.email);

  const totalAmountCents = coalesceCents(
    payload.total_amount_cents,
    toMajorUnitCents(payload.total_amount),
    toMajorUnitCents(payload.total),
    toMajorUnitCents(payload.amount),
    payment?.charge_amount
  );

  const netAmountCents = coalesceCents(
    payload.net_amount_cents,
    toMajorUnitOrCents(payload.net_amount),
    toMajorUnitOrCents(payload.net),
    payment?.net_amount
  );

  const feeAmountCents = coalesceCents(
    payload.fee_amount_cents,
    toMajorUnitCents(payload.fee_amount),
    toMajorUnitCents(payload.fees),
    payment?.fee
  );

  return {
    id,
    status: toNullableString(payload.status),
    product_id: productId,
    product_title: productTitle,
    customer_id: customerId,
    customer_name: customerName,
    customer_email: customerEmail,
    total_amount_cents: totalAmountCents,
    net_amount_cents: netAmountCents,
    fee_amount_cents: feeAmountCents,
    currency: toNullableString(payload.currency ?? payload.currency_code) ?? 'BRL',
    installments: toNullableNumber(payload.installments ?? payload.installments_count),
    created_at: toIso(payload.created_at ?? payload.createdAt ?? payload.inserted_at ?? null),
    paid_at: toIso(payload.paid_at ?? payload.paidAt ?? payload.approved_at ?? null),
    updated_at: toIso(payload.updated_at ?? payload.updatedAt ?? null),
    raw: sanitizeRaw(payload)
  };
}

function sanitizeRaw(payload: UnknownRecord): UnknownRecord {
  return JSON.parse(JSON.stringify(payload)) as UnknownRecord;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableCents(value: unknown): number | null {
  const num = toNullableNumber(value);
  if (num === null || Number.isNaN(num)) {
    return null;
  }
  return Math.round(num);
}

function toMajorUnitCents(value: unknown): number | null {
  const num = toNullableNumber(value);
  if (num === null || Number.isNaN(num)) {
    return null;
  }
  return Math.round(num * 100);
}

function toMajorUnitOrCents(value: unknown): number | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    if (trimmed.includes('.') || trimmed.includes(',')) {
      return toMajorUnitCents(trimmed);
    }
    return toNullableCents(trimmed);
  }
  return toMajorUnitCents(value);
}

function coalesceCents(...candidates: readonly unknown[]): number | null {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }
    const cents = toNullableCents(candidate);
    if (cents !== null) {
      return cents;
    }
  }
  return null;
}

function toIso(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
