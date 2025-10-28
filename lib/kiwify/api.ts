import { kiwifyFetch, type KiwifyRequestInit } from './http';

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'string') {
      if (value.trim() === '') {
        continue;
      }
      search.set(key, value);
      continue;
    }
    if (typeof value === 'boolean') {
      search.set(key, value ? 'true' : 'false');
      continue;
    }
    if (typeof value === 'number') {
      if (Number.isNaN(value)) {
        continue;
      }
      search.set(key, value.toString());
    }
  }

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function fetchJson<T>(path: string, init: KiwifyRequestInit = {}): Promise<T> {
  const response = await kiwifyFetch(path, init);
  if (response.status === 204 || response.status === 205) {
    return null as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resposta inesperada da Kiwify para ${path}: ${body.slice(0, 256)}`);
  }

  return (await response.json()) as T;
}

export async function fetchAccount(): Promise<unknown> {
  return fetchJson('/account');
}

export interface ListProductsParams {
  readonly pageSize?: number;
  readonly page?: number;
}

export async function listProducts(params: ListProductsParams): Promise<unknown> {
  const query = buildQuery({ page_size: params.pageSize, page: params.page });
  return fetchJson(`/products${query}`);
}

export async function getProduct(productId: string): Promise<unknown> {
  return fetchJson(`/products/${encodeURIComponent(productId)}`);
}

export interface ListSalesParams {
  readonly startDate: string;
  readonly endDate: string;
  readonly status?: string;
  readonly paymentMethod?: string;
  readonly productId?: string;
  readonly fullDetails?: boolean;
  readonly pageSize?: number;
  readonly page?: number;
}

export async function listSales(params: ListSalesParams): Promise<unknown> {
  const query = buildQuery({
    start_date: params.startDate,
    end_date: params.endDate,
    status: params.status,
    payment_method: params.paymentMethod,
    product_id: params.productId,
    full_details: params.fullDetails,
    page_size: params.pageSize,
    page: params.page
  });
  return fetchJson(`/sales${query}`);
}

export async function getSale(saleId: string): Promise<unknown> {
  return fetchJson(`/sales/${encodeURIComponent(saleId)}`);
}

export interface RefundSalePayload {
  readonly pixKey?: string;
}

export async function refundSale(saleId: string, payload: RefundSalePayload): Promise<unknown> {
  const body: Record<string, unknown> = {};
  if (payload.pixKey) {
    body.pix_key = payload.pixKey;
  }
  return fetchJson(`/sales/${encodeURIComponent(saleId)}/refund`, { method: 'POST', json: body });
}

export interface SalesStatsParams {
  readonly startDate: string;
  readonly endDate: string;
  readonly productId?: string;
}

export async function fetchSalesStats(params: SalesStatsParams): Promise<unknown> {
  const query = buildQuery({
    start_date: params.startDate,
    end_date: params.endDate,
    product_id: params.productId
  });
  return fetchJson(`/sales/stats${query}`);
}

export interface ListAffiliatesParams {
  readonly pageSize?: number;
  readonly page?: number;
  readonly status?: string;
  readonly productId?: string;
  readonly search?: string;
}

export async function listAffiliates(params: ListAffiliatesParams): Promise<unknown> {
  const query = buildQuery({
    page_size: params.pageSize,
    page: params.page,
    status: params.status,
    product_id: params.productId,
    search: params.search
  });
  return fetchJson(`/affiliates${query}`);
}

export async function getAffiliate(affiliateId: string): Promise<unknown> {
  return fetchJson(`/affiliates/${encodeURIComponent(affiliateId)}`);
}

export interface UpdateAffiliatePayload {
  readonly commission?: number;
  readonly status?: string;
}

export async function updateAffiliate(affiliateId: string, payload: UpdateAffiliatePayload): Promise<unknown> {
  const body: Record<string, unknown> = {};
  if (typeof payload.commission === 'number' && !Number.isNaN(payload.commission)) {
    body.commission = payload.commission;
  }
  if (payload.status) {
    body.status = payload.status;
  }
  return fetchJson(`/affiliates/${encodeURIComponent(affiliateId)}`, { method: 'PUT', json: body });
}

export interface ListWebhooksParams {
  readonly pageSize?: number;
  readonly page?: number;
  readonly productId?: string;
  readonly search?: string;
}

export async function listWebhooks(params: ListWebhooksParams): Promise<unknown> {
  const query = buildQuery({
    page_size: params.pageSize,
    page: params.page,
    product_id: params.productId,
    search: params.search
  });
  return fetchJson(`/webhooks${query}`);
}

export async function getWebhook(webhookId: string): Promise<unknown> {
  return fetchJson(`/webhooks/${encodeURIComponent(webhookId)}`);
}

export interface UpsertWebhookPayload {
  readonly name: string;
  readonly url: string;
  readonly products?: string;
  readonly triggers: readonly string[];
  readonly token?: string;
}

function buildWebhookBody(payload: UpsertWebhookPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: payload.name,
    url: payload.url,
    triggers: payload.triggers
  };
  if (payload.products && payload.products.trim() !== '') {
    body.products = payload.products;
  }
  if (payload.token && payload.token.trim() !== '') {
    body.token = payload.token;
  }
  return body;
}

export async function createWebhook(payload: UpsertWebhookPayload): Promise<unknown> {
  return fetchJson('/webhooks', { method: 'POST', json: buildWebhookBody(payload) });
}

export async function updateWebhook(webhookId: string, payload: UpsertWebhookPayload): Promise<unknown> {
  return fetchJson(`/webhooks/${encodeURIComponent(webhookId)}`, { method: 'PUT', json: buildWebhookBody(payload) });
}

export async function deleteWebhook(webhookId: string): Promise<unknown> {
  return fetchJson(`/webhooks/${encodeURIComponent(webhookId)}`, { method: 'DELETE' });
}

export interface ListParticipantsParams {
  readonly productId: string;
  readonly checkedIn?: boolean;
  readonly pageSize?: number;
  readonly page?: number;
  readonly createdAtStart?: string;
  readonly createdAtEnd?: string;
  readonly updatedAtStart?: string;
  readonly updatedAtEnd?: string;
  readonly externalId?: string;
  readonly batchId?: string;
  readonly phone?: string;
  readonly cpf?: string;
  readonly orderId?: string;
}

export async function listParticipants(params: ListParticipantsParams): Promise<unknown> {
  const query = buildQuery({
    product_id: params.productId,
    checked_in: params.checkedIn,
    page_size: params.pageSize,
    page: params.page,
    created_at_start: params.createdAtStart,
    created_at_end: params.createdAtEnd,
    updated_at_start: params.updatedAtStart,
    updated_at_end: params.updatedAtEnd,
    external_id: params.externalId,
    batch_id: params.batchId,
    phone: params.phone,
    cpf: params.cpf,
    order_id: params.orderId
  });
  return fetchJson(`/events/participants${query}`);
}

export async function fetchBalances(): Promise<unknown> {
  return fetchJson('/balances');
}

export async function fetchBalanceByLegalEntity(legalEntityId: string): Promise<unknown> {
  return fetchJson(`/balances/${encodeURIComponent(legalEntityId)}`);
}

export interface ListWithdrawalsParams {
  readonly legalEntityId?: string;
  readonly pageSize?: number;
  readonly page?: number;
}

export async function listWithdrawals(params: ListWithdrawalsParams): Promise<unknown> {
  const query = buildQuery({
    legal_entity_id: params.legalEntityId,
    page_size: params.pageSize,
    page: params.page
  });
  return fetchJson(`/withdrawals${query}`);
}

export async function getWithdrawal(withdrawalId: string): Promise<unknown> {
  return fetchJson(`/withdrawals/${encodeURIComponent(withdrawalId)}`);
}

export interface CreateWithdrawalPayload {
  readonly amountCents: number;
  readonly legalEntityId: string;
}

export async function createWithdrawal(payload: CreateWithdrawalPayload): Promise<unknown> {
  return fetchJson('/withdrawals', {
    method: 'POST',
    json: {
      amount: payload.amountCents,
      legal_entity_id: payload.legalEntityId
    }
  });
}
