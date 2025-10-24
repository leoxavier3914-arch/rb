import "server-only";

import { cache } from "react";
import { z } from "zod";

import {
  kfyCouponSchema,
  kfyCustomerSchema,
  kfyEnrollmentSchema,
  kfyOrderSchema,
  kfyProductSchema,
  kfyRefundSchema,
  paginationCursorSchema,
  type KfyCoupon,
  type KfyCustomer,
  type KfyEnrollment,
  type KfyOrder,
  type KfyProduct,
  type KfyRefund,
} from "@/types/kfy";
import { mapPaymentMethod, mapStatus } from "./kfyMapping";

const envSchema = z.object({
  KIWIFY_CLIENT_ID: z.string().min(1, "KIWIFY_CLIENT_ID é obrigatório"),
  KIWIFY_CLIENT_SECRET: z.string().min(1, "KIWIFY_CLIENT_SECRET é obrigatório"),
  KIWIFY_ACCOUNT_ID: z.string().optional(),
  KIWIFY_API_URL: z.string().url().default("https://api.kiwify.com.br/v1"),
});

const parsed = envSchema.parse({
  KIWIFY_CLIENT_ID: process.env.KIWIFY_CLIENT_ID,
  KIWIFY_CLIENT_SECRET: process.env.KIWIFY_CLIENT_SECRET,
  KIWIFY_ACCOUNT_ID: process.env.KIWIFY_ACCOUNT_ID,
  KIWIFY_API_URL: process.env.KIWIFY_API_URL,
});

interface FetchOptions extends RequestInit {
  searchParams?: Record<string, string | number | boolean | undefined>;
}

interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

interface SyncOptions {
  cursor?: string | null;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

const tokenCache = {
  value: null as string | null,
  expiresAt: 0,
};

async function requestNewToken(): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch(`${parsed.KIWIFY_API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: parsed.KIWIFY_CLIENT_ID,
      client_secret: parsed.KIWIFY_CLIENT_SECRET,
      account_id: parsed.KIWIFY_ACCOUNT_ID,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao obter token da Kiwify: ${response.status} ${errorText}`);
  }

  return response.json();
}

export const getAccessToken = cache(async () => {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const { access_token, expires_in } = await requestNewToken();
  tokenCache.value = access_token;
  tokenCache.expiresAt = Date.now() + expires_in * 1000;
  return access_token;
});

async function fetchWithRetry<T>(path: string, options: FetchOptions = {}, attempt = 0): Promise<T> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  const url = new URL(path, parsed.KIWIFY_API_URL);
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (response.status === 401 && attempt < 2) {
    tokenCache.value = null;
    await getAccessToken();
    return fetchWithRetry(path, options, attempt + 1);
  }

  if ([429, 500, 502, 503].includes(response.status) && attempt < 5) {
    const backoff = Math.min(1000 * 2 ** attempt, 10_000);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return fetchWithRetry(path, options, attempt + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API Kiwify (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

async function fetchPaginated<T>(path: string, options: SyncOptions = {}): Promise<PaginatedResponse<T>> {
  const data = await fetchWithRetry<{ data: T[]; cursor?: { next: string | null } }>(path, {
    searchParams: {
      cursor: options.cursor ?? undefined,
      status: options.status,
      date_from: options.dateFrom,
      date_to: options.dateTo,
    },
  });

  const cursorResult = paginationCursorSchema.safeParse({
    nextCursor: data.cursor?.next ?? null,
  });

  return {
    data: data.data,
    nextCursor: cursorResult.success ? cursorResult.data.nextCursor ?? null : null,
  };
}

function normalizeOrder(raw: any): KfyOrder {
  const parsedOrder = kfyOrderSchema.parse({
    externalId: raw.id ?? raw.external_id ?? "",
    productExternalId: raw.product_id ?? raw.product?.id ?? "",
    customerExternalId: raw.customer_id ?? raw.customer?.id ?? "",
    status: mapStatus(raw.status ?? raw.payment_status),
    paymentMethod: mapPaymentMethod(raw.payment_method),
    grossCents: Number.parseInt(String(raw.amount_gross ?? raw.gross_cents ?? 0), 10),
    feeCents: Number.parseInt(String(raw.amount_fee ?? raw.fee_cents ?? 0), 10),
    netCents: Number.parseInt(String(raw.amount_net ?? raw.net_cents ?? 0), 10),
    commissionCents: Number.parseInt(String(raw.amount_commission ?? raw.commission_cents ?? 0), 10),
    currency: (raw.currency ?? "BRL") as string,
    approvedAt: raw.approved_at ? new Date(raw.approved_at) : null,
    refundedAt: raw.refunded_at ? new Date(raw.refunded_at) : null,
    canceledAt: raw.canceled_at ? new Date(raw.canceled_at) : null,
    createdAt: new Date(raw.created_at ?? Date.now()),
    updatedAt: new Date(raw.updated_at ?? raw.created_at ?? Date.now()),
    raw,
  });

  return parsedOrder;
}

function normalizeProduct(raw: any): KfyProduct {
  return kfyProductSchema.parse({
    externalId: raw.id ?? raw.external_id ?? "",
    title: raw.title ?? raw.name ?? "",
    description: raw.description ?? null,
    imageUrl: raw.image_url ?? raw.cover_url ?? null,
    priceCents: Number.parseInt(String(raw.price_cents ?? raw.price ?? 0), 10),
    currency: (raw.currency ?? "BRL") as string,
    status: mapStatus(raw.status ?? "pending"),
    createdAt: new Date(raw.created_at ?? Date.now()),
    updatedAt: new Date(raw.updated_at ?? raw.created_at ?? Date.now()),
    raw,
  });
}

function normalizeCustomer(raw: any): KfyCustomer {
  return kfyCustomerSchema.parse({
    externalId: raw.id ?? raw.external_id ?? "",
    name: raw.name ?? `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim(),
    email: raw.email ?? "sem-email@kiwify.com",
    phone: raw.phone ?? null,
    country: raw.country ?? null,
    createdAt: new Date(raw.created_at ?? Date.now()),
    updatedAt: new Date(raw.updated_at ?? raw.created_at ?? Date.now()),
    raw,
  });
}

function normalizeRefund(raw: any): KfyRefund {
  return kfyRefundSchema.parse({
    externalId: raw.id ?? raw.external_id ?? "",
    orderExternalId: raw.order_id ?? raw.order?.id ?? "",
    reason: raw.reason ?? null,
    amountCents: Number.parseInt(String(raw.amount_cents ?? raw.amount ?? 0), 10),
    status: mapStatus(raw.status ?? "refunded"),
    createdAt: new Date(raw.created_at ?? Date.now()),
    processedAt: raw.processed_at ? new Date(raw.processed_at) : null,
    raw,
  });
}

function normalizeEnrollment(raw: any): KfyEnrollment {
  return kfyEnrollmentSchema.parse({
    externalId: raw.id ?? raw.external_id ?? "",
    customerExternalId: raw.customer_id ?? raw.customer?.id ?? "",
    productExternalId: raw.product_id ?? raw.product?.id ?? "",
    status: mapStatus(raw.status ?? raw.access_status ?? "pending"),
    startedAt: raw.started_at ? new Date(raw.started_at) : null,
    expiresAt: raw.expires_at ? new Date(raw.expires_at) : null,
    createdAt: new Date(raw.created_at ?? Date.now()),
    updatedAt: new Date(raw.updated_at ?? raw.created_at ?? Date.now()),
    raw,
  });
}

function normalizeCoupon(raw: any): KfyCoupon {
  return kfyCouponSchema.parse({
    externalId: raw.id ?? raw.external_id ?? "",
    code: raw.code ?? "",
    type: (raw.type ?? raw.discount_type ?? "percent") === "amount" ? "amount" : "percent",
    value: Number(raw.value ?? raw.amount ?? 0),
    active: Boolean(raw.active ?? raw.enabled ?? true),
    createdAt: new Date(raw.created_at ?? Date.now()),
    updatedAt: new Date(raw.updated_at ?? raw.created_at ?? Date.now()),
    raw,
  });
}

async function collectAll<T>(
  path: string,
  normalizer: (item: any) => T,
  options: SyncOptions = {},
): Promise<{ items: T[]; nextCursor: string | null }> {
  const items: T[] = [];
  let cursor: string | null | undefined = options.cursor ?? null;

  do {
    const page = await fetchPaginated<any>(path, { ...options, cursor });
    items.push(...page.data.map((item) => normalizer(item)));
    cursor = page.nextCursor;
    if (!cursor) {
      return { items, nextCursor: null };
    }
  } while (cursor);

  return { items, nextCursor: null };
}

export async function listOrders(options: SyncOptions = {}): Promise<{ items: KfyOrder[]; nextCursor: string | null }> {
  return collectAll("/orders", normalizeOrder, options);
}

export async function listRefunds(options: SyncOptions = {}): Promise<{ items: KfyRefund[]; nextCursor: string | null }> {
  return collectAll("/refunds", normalizeRefund, options);
}

export async function listProducts(options: SyncOptions = {}): Promise<{ items: KfyProduct[]; nextCursor: string | null }> {
  return collectAll("/products", normalizeProduct, options);
}

export async function createProduct(payload: Partial<KfyProduct>) {
  const response = await fetchWithRetry<any>("/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response);
}

export async function updateProduct(externalId: string, payload: Partial<KfyProduct>) {
  const response = await fetchWithRetry<any>(`/products/${externalId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return normalizeProduct(response);
}

export async function deleteProduct(externalId: string) {
  await fetchWithRetry(`/products/${externalId}`, { method: "DELETE" });
}

export async function listCustomers(options: SyncOptions = {}): Promise<{ items: KfyCustomer[]; nextCursor: string | null }> {
  return collectAll("/customers", normalizeCustomer, options);
}

export async function listEnrollments(
  options: SyncOptions = {},
): Promise<{ items: KfyEnrollment[]; nextCursor: string | null }> {
  return collectAll("/enrollments", normalizeEnrollment, options);
}

export async function listCoupons(options: SyncOptions = {}): Promise<{ items: KfyCoupon[]; nextCursor: string | null }> {
  return collectAll("/coupons", normalizeCoupon, options);
}

export async function syncAllResources(
  iterator: <T>(
    resourceFetcher: (options: SyncOptions) => Promise<{ items: T[]; nextCursor: string | null }>,
    upsert: (items: T[]) => Promise<void>,
    options?: SyncOptions,
  ) => Promise<void>,
  options: { from?: string; to?: string; full?: boolean } = {},
) {
  const windowOptions: SyncOptions = options.full
    ? {}
    : {
        dateFrom: options.from,
        dateTo: options.to,
      };

  await iterator(listProducts, async () => {}, windowOptions);
  await iterator(listCustomers, async () => {}, windowOptions);
  await iterator(listOrders, async () => {}, windowOptions);
  await iterator(listRefunds, async () => {}, windowOptions);
  await iterator(listEnrollments, async () => {}, windowOptions);
  await iterator(listCoupons, async () => {}, windowOptions);
}

export function getAccessTokenMetadata() {
  return {
    hasToken: Boolean(tokenCache.value),
    expiresAt: tokenCache.expiresAt ? new Date(tokenCache.expiresAt).toISOString() : null,
  };
}
