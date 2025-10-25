import "server-only";

import { z } from "zod";

import { kiwifyApiEnv } from "@/lib/env";
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
  KIWIFY_API_URL: z.string().url().default("https://public-api.kiwify.com/v1/"),
  KIWIFY_API_SCOPE: z.string().optional(),
  KIWIFY_API_AUDIENCE: z.string().optional(),
  KIWIFY_PARTNER_ID: z.string().optional(),
});

const parsedEnv = envSchema.safeParse({
  KIWIFY_CLIENT_ID: process.env.KIWIFY_CLIENT_ID,
  KIWIFY_CLIENT_SECRET: process.env.KIWIFY_CLIENT_SECRET,
  KIWIFY_ACCOUNT_ID: process.env.KIWIFY_ACCOUNT_ID,
  KIWIFY_API_URL: process.env.KIWIFY_API_URL,
  KIWIFY_API_SCOPE: process.env.KIWIFY_API_SCOPE,
  KIWIFY_API_AUDIENCE: process.env.KIWIFY_API_AUDIENCE,
  KIWIFY_PARTNER_ID: process.env.KIWIFY_PARTNER_ID,
});

type LegacyEnv = z.infer<typeof envSchema>;

type ApiConfig = {
  clientId: string;
  clientSecret: string;
  accountId?: string;
  scope?: string;
  audience?: string;
  partnerId?: string;
  baseUrl: URL;
  basePathSegments: string[];
  prefixSegments: string[];
};

type TokenCacheState = {
  value: string | null;
  tokenType: string;
  scope: string | null;
  expiresAt: number;
  obtainedAt: number | null;
};

type KiwifyRequestError = Error & {
  status: number;
  url: string;
  body: string;
};

const globalState = globalThis as typeof globalThis & {
  __kfyApiConfig?: ApiConfig | null;
  __kfyTokenCache?: TokenCacheState | null;
};

const getTokenCache = (): TokenCacheState => {
  if (!globalState.__kfyTokenCache) {
    globalState.__kfyTokenCache = {
      value: null,
      tokenType: "Bearer",
      scope: null,
      expiresAt: 0,
      obtainedAt: null,
    } satisfies TokenCacheState;
  }
  return globalState.__kfyTokenCache;
};

const normalizeSegments = (value: string | undefined) => {
  if (!value) {
    return [] as string[];
  }

  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const joinSegments = (segments: string[]) => {
  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
};

const buildApiConfigFromLegacyEnv = (env: LegacyEnv): ApiConfig => {
  const fullUrl = new URL(env.KIWIFY_API_URL);
  fullUrl.search = "";
  fullUrl.hash = "";

  const baseUrl = new URL(`${fullUrl.protocol}//${fullUrl.host}`);
  baseUrl.pathname = "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  const prefixSegments = normalizeSegments(fullUrl.pathname);

  return {
    clientId: env.KIWIFY_CLIENT_ID,
    clientSecret: env.KIWIFY_CLIENT_SECRET,
    accountId: env.KIWIFY_ACCOUNT_ID,
    scope: env.KIWIFY_API_SCOPE,
    audience: env.KIWIFY_API_AUDIENCE,
    partnerId: env.KIWIFY_PARTNER_ID,
    baseUrl,
    basePathSegments: [],
    prefixSegments,
  } satisfies ApiConfig;
};

const buildApiConfigFromModernEnv = (): ApiConfig | null => {
  const hasModernEnv = Boolean(process.env.KIWIFY_API_BASE_URL?.trim());

  if (!hasModernEnv) {
    return null;
  }

  const env = kiwifyApiEnv.maybe();

  if (!env) {
    return null;
  }

  const baseUrl = new URL(env.KIWIFY_API_BASE_URL);
  baseUrl.search = "";
  baseUrl.hash = "";

  const basePathSegments = normalizeSegments(baseUrl.pathname);
  baseUrl.pathname = "/";

  return {
    clientId: env.KIWIFY_CLIENT_ID,
    clientSecret: env.KIWIFY_CLIENT_SECRET,
    accountId: env.KIWIFY_ACCOUNT_ID,
    scope: env.KIWIFY_API_SCOPE,
    audience: env.KIWIFY_API_AUDIENCE,
    partnerId: env.KIWIFY_PARTNER_ID,
    baseUrl,
    basePathSegments,
    prefixSegments: normalizeSegments(env.KIWIFY_API_PATH_PREFIX),
  } satisfies ApiConfig;
};

const getApiConfig = (): ApiConfig => {
  if (globalState.__kfyApiConfig) {
    return globalState.__kfyApiConfig;
  }

  const modernConfig = buildApiConfigFromModernEnv();

  if (modernConfig) {
    globalState.__kfyApiConfig = modernConfig;
    return modernConfig;
  }

  if (!parsedEnv.success) {
    throw new Error(`Variáveis da Kiwify ausentes: ${parsedEnv.error.message}`);
  }

  const legacyConfig = buildApiConfigFromLegacyEnv(parsedEnv.data);
  globalState.__kfyApiConfig = legacyConfig;
  return legacyConfig;
};

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

const splitRequestPathSegments = (path: string) => {
  const [cleanPath] = path.split("?");
  return normalizeSegments(cleanPath);
};

const createRequestError = (
  status: number,
  url: string,
  body: string,
  message?: string,
): KiwifyRequestError => {
  const error = new Error(message ?? `Erro na API Kiwify (${status}): ${body}`) as KiwifyRequestError;
  error.status = status;
  error.url = url;
  error.body = body;
  return error;
};

const buildRequestUrl = (
  config: ApiConfig,
  pathSegments: string[],
  searchParams?: Record<string, string | number | boolean | undefined>,
) => {
  const url = new URL(config.baseUrl.toString());
  const segments = [...config.basePathSegments, ...pathSegments];
  url.pathname = joinSegments(segments);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  return url;
};

const buildPrefixVariants = (prefixSegments: string[]) => {
  const variants: string[][] = [];
  const seen = new Set<string>();

  const addVariant = (segments: string[]) => {
    const key = segments.join("/");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    variants.push(segments);
  };

  addVariant(prefixSegments);

  for (let index = 1; index < prefixSegments.length; index += 1) {
    addVariant(prefixSegments.slice(index));
  }

  for (let index = prefixSegments.length - 1; index >= 0; index -= 1) {
    addVariant(prefixSegments.slice(0, index));
  }

  addVariant([]);
  addVariant(["api", ...prefixSegments]);
  if (prefixSegments.length > 0) {
    addVariant(["api", ...prefixSegments.slice(1)]);
  }
  addVariant(["api"]);
  addVariant(["v1"]);
  addVariant(["api", "v1"]);

  return variants;
};

const buildTokenUrlCandidates = (config: ApiConfig) => {
  const variants: string[][] = [];
  const baseVariants = buildPrefixVariants(config.prefixSegments);

  for (const variant of baseVariants) {
    variants.push([...config.basePathSegments, ...variant, "oauth", "token"]);
    variants.push([...variant, "oauth", "token"]);
  }

  variants.push([...config.basePathSegments, "oauth", "token"]);
  variants.push(["oauth", "token"]);

  const urls: string[] = [];
  const seen = new Set<string>();

  for (const segments of variants) {
    const filtered = segments.filter((segment) => segment.length > 0);
    const key = filtered.join("/");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const url = new URL(config.baseUrl.toString());
    url.pathname = joinSegments(filtered);
    urls.push(url.toString());
  }

  return urls;
};

const resetTokenCache = () => {
  const cache = getTokenCache();
  cache.value = null;
  cache.tokenType = "Bearer";
  cache.scope = null;
  cache.expiresAt = 0;
  cache.obtainedAt = null;
};

const isKiwifyRequestError = (error: unknown): error is KiwifyRequestError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  );
};

async function requestNewToken(): Promise<{
  token: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}> {
  const config = getApiConfig();
  const payload = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  if (config.accountId) {
    payload.set("account_id", config.accountId);
  }

  if (config.scope) {
    payload.set("scope", config.scope);
  }

  if (config.audience) {
    payload.set("audience", config.audience);
  }

  const tokenUrls = buildTokenUrlCandidates(config);
  let lastError: KiwifyRequestError | null = null;

  for (const tokenUrl of tokenUrls) {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(payload),
      cache: "no-store",
    });

    if (response.ok) {
      const tokenResponse = (await response.json()) as {
        access_token: string;
        token_type?: string;
        expires_in: number;
        scope?: string;
      };

      return {
        token: tokenResponse.access_token,
        tokenType: tokenResponse.token_type ?? "Bearer",
        expiresIn: tokenResponse.expires_in,
        scope: tokenResponse.scope,
      };
    }

    const errorText = await response.text();
    lastError = createRequestError(
      response.status,
      tokenUrl,
      errorText,
      `Erro ao obter token da Kiwify (${response.status}): ${errorText}`,
    );

    if (response.status !== 404) {
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Erro ao obter token da Kiwify: caminho do token não encontrado");
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  const cache = getTokenCache();

  if (!forceRefresh && cache.value && Date.now() < cache.expiresAt - 60_000) {
    return cache.value;
  }

  const { token, tokenType, expiresIn, scope } = await requestNewToken();
  const now = Date.now();

  cache.value = token;
  cache.tokenType = tokenType || "Bearer";
  cache.scope = scope ?? null;
  cache.expiresAt = now + expiresIn * 1000;
  cache.obtainedAt = now;

  return token;
}

async function performRequest<T>(
  config: ApiConfig,
  pathSegments: string[],
  options: FetchOptions,
  attempt: number,
): Promise<T> {
  const token = await getAccessToken();
  const cache = getTokenCache();
  const headers = new Headers(options.headers);

  headers.set("Authorization", `${cache.tokenType || "Bearer"} ${token}`);
  headers.set("Accept", "application/json");

  if (config.accountId) {
    headers.set("x-kiwify-account-id", config.accountId);
  }

  if (config.partnerId) {
    headers.set("x-kiwify-partner-id", config.partnerId);
  }

  const url = buildRequestUrl(config, pathSegments, options.searchParams);

  const { searchParams: _ignored, ...init } = options;
  const requestInit: RequestInit = {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  };

  const response = await fetch(url, requestInit);

  if (response.status === 401 && attempt < 2) {
    resetTokenCache();
    await getAccessToken(true);
    return performRequest(config, pathSegments, options, attempt + 1);
  }

  if ([429, 500, 502, 503].includes(response.status) && attempt < 5) {
    const backoff = Math.min(1000 * 2 ** attempt, 10_000);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return performRequest(config, pathSegments, options, attempt + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw createRequestError(response.status, url.toString(), errorText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return (text === "" ? (undefined as T) : ((text as unknown) as T)) as T;
}

async function fetchWithRetry<T>(path: string, options: FetchOptions = {}, attempt = 0): Promise<T> {
  const config = getApiConfig();
  const requestSegments = splitRequestPathSegments(path);
  const prefixVariants = buildPrefixVariants(config.prefixSegments);
  let lastNotFound: KiwifyRequestError | null = null;

  for (const variant of prefixVariants) {
    const combinedSegments = [...variant, ...requestSegments];

    try {
      return await performRequest<T>(config, combinedSegments, options, attempt);
    } catch (error) {
      if (isKiwifyRequestError(error) && error.status === 404) {
        lastNotFound = error;
        continue;
      }
      throw error;
    }
  }

  if (lastNotFound) {
    throw lastNotFound;
  }

  const fallbackUrl = buildRequestUrl(config, requestSegments, options.searchParams);
  throw createRequestError(404, fallbackUrl.toString(), "", `Erro na API Kiwify (404): recurso ${path} não encontrado`);
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
    const page: PaginatedResponse<T> = await fetchPaginated<T>(path, { ...options, cursor });
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
  const cache = getTokenCache();

  return {
    hasToken: Boolean(cache.value),
    expiresAt: cache.expiresAt ? new Date(cache.expiresAt).toISOString() : null,
    obtainedAt: cache.obtainedAt ? new Date(cache.obtainedAt).toISOString() : null,
    tokenType: cache.tokenType,
    scope: cache.scope,
  };
}

export function __resetKfyClientStateForTesting() {
  globalState.__kfyApiConfig = null;
  globalState.__kfyTokenCache = null;
}
