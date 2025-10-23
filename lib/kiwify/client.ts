import { getKiwifyApiEnv, hasKiwifyApiEnv } from "@/lib/env";

const TOKEN_CACHE_KEY = "__kiwifyApiTokenCache";

type NextFetchRequestConfig = {
  revalidate?: number | false;
  tags?: string[];
};

interface TokenCacheEntry {
  accessToken: string;
  tokenType: string;
  scope?: string;
  expiresAt: number;
  obtainedAt: number;
}

const globalCache = globalThis as typeof globalThis & {
  [TOKEN_CACHE_KEY]?: TokenCacheEntry | null;
};

export interface KiwifyAccessTokenMetadata {
  tokenType: string;
  scope?: string;
  expiresAt: number;
  obtainedAt: number;
  preview: string;
}

export interface KiwifyFetchOptions {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | Record<string, unknown> | null;
  searchParams?: Record<string, string | number | boolean | null | undefined>;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  revalidate?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

export class KiwifyApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  readonly request: { method: string; url: string };

  constructor(message: string, status: number, request: { method: string; url: string }, details: unknown) {
    super(message);
    this.name = "KiwifyApiError";
    this.status = status;
    this.request = request;
    this.details = details;
  }
}

const ensureTokenCache = (): TokenCacheEntry | null => {
  return globalCache[TOKEN_CACHE_KEY] ?? null;
};

const saveTokenCache = (entry: TokenCacheEntry | null) => {
  globalCache[TOKEN_CACHE_KEY] = entry;
};

const buildTokenPreview = (token: string) => {
  if (!token) {
    return "";
  }

  if (token.length <= 12) {
    return token;
  }

  return `${token.slice(0, 6)}…${token.slice(-4)}`;
};

async function requestAccessToken(forceRefresh = false): Promise<TokenCacheEntry> {
  if (!hasKiwifyApiEnv()) {
    throw new Error("As variáveis de ambiente da API da Kiwify não estão configuradas.");
  }

  const cached = ensureTokenCache();

  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 30_000) {
    return cached;
  }

  const {
    KIWIFY_API_BASE_URL,
    KIWIFY_API_CLIENT_ID,
    KIWIFY_API_CLIENT_SECRET,
    KIWIFY_API_SCOPE,
    KIWIFY_API_AUDIENCE,
  } = getKiwifyApiEnv();

  const tokenUrl = new URL("oauth/token", KIWIFY_API_BASE_URL);
  const payload = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: KIWIFY_API_CLIENT_ID,
    client_secret: KIWIFY_API_CLIENT_SECRET,
  });

  if (KIWIFY_API_SCOPE) {
    payload.set("scope", KIWIFY_API_SCOPE);
  }

  if (KIWIFY_API_AUDIENCE) {
    payload.set("audience", KIWIFY_API_AUDIENCE);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorDetails = await safeParseBody(response);
    throw new KiwifyApiError("Falha ao autenticar na API da Kiwify.", response.status, {
      method: "POST",
      url: tokenUrl.toString(),
    }, errorDetails);
  }

  const tokenResponse = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
  };

  const now = Date.now();
  const expiresAt = now + Math.max(0, (tokenResponse.expires_in - 60) * 1000);
  const entry: TokenCacheEntry = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    obtainedAt: now,
    expiresAt,
  };

  saveTokenCache(entry);
  return entry;
}

async function safeParseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }

    const text = await response.text();
    return text ? { message: text } : null;
  } catch (error) {
    console.warn("Não foi possível interpretar a resposta da Kiwify", error);
    return null;
  }
}

async function resolveBody(body: KiwifyFetchOptions["body"], headers: Headers) {
  if (!body) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return body;
  }

  if (ArrayBuffer.isView(body)) {
    return body as BodyInit;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body;
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return body as BodyInit;
  }

  headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}

export async function getAccessTokenMetadata(forceRefresh = false): Promise<KiwifyAccessTokenMetadata> {
  const entry = await requestAccessToken(forceRefresh);

  return {
    tokenType: entry.tokenType,
    scope: entry.scope,
    expiresAt: entry.expiresAt,
    obtainedAt: entry.obtainedAt,
    preview: buildTokenPreview(entry.accessToken),
  };
}

export async function invalidateCachedToken() {
  saveTokenCache(null);
}

export async function kiwifyFetch<T>(path: string, options: KiwifyFetchOptions = {}): Promise<T> {
  if (!hasKiwifyApiEnv()) {
    throw new Error("As variáveis de ambiente da API da Kiwify não estão configuradas.");
  }

  const {
    method = "GET",
    headers: customHeaders,
    body,
    searchParams,
    cache,
    next,
    revalidate,
    signal,
    skipAuth = false,
  } = options;

  const { KIWIFY_API_BASE_URL } = getKiwifyApiEnv();
  const url = new URL(path, KIWIFY_API_BASE_URL);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === null || value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(customHeaders);

  if (!skipAuth) {
    const token = await requestAccessToken();
    headers.set("Authorization", `${token.tokenType} ${token.accessToken}`);
  }

  const resolvedBody = await resolveBody(body, headers);
  const init: RequestInit & { next?: NextFetchRequestConfig } = {
    method,
    headers,
    cache,
    signal,
  };

  if (resolvedBody !== undefined) {
    init.body = resolvedBody;
  }

  if (revalidate !== undefined) {
    init.next = { ...(next ?? {}), revalidate };
  } else if (next) {
    init.next = next;
  }

  const response = await fetch(url, init);

  if (response.status === 401 && !skipAuth) {
    await invalidateCachedToken();
    const token = await requestAccessToken(true);
    headers.set("Authorization", `${token.tokenType} ${token.accessToken}`);
    const retryResponse = await fetch(url, {
      ...init,
      headers,
    });

    if (!retryResponse.ok) {
      const errorDetails = await safeParseBody(retryResponse);
      throw new KiwifyApiError("Falha ao consultar a API da Kiwify.", retryResponse.status, {
        method,
        url: url.toString(),
      }, errorDetails);
    }

    return (await safeParseResponse<T>(retryResponse)) as T;
  }

  if (!response.ok) {
    const errorDetails = await safeParseBody(response);
    throw new KiwifyApiError("Falha ao consultar a API da Kiwify.", response.status, {
      method,
      url: url.toString(),
    }, errorDetails);
  }

  return (await safeParseResponse<T>(response)) as T;
}

async function safeParseResponse<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return text === "" ? (undefined as T) : ((text as unknown) as T);
}

export function getPartnerIdFromEnv() {
  if (!hasKiwifyApiEnv()) {
    return null;
  }

  const { KIWIFY_PARTNER_ID } = getKiwifyApiEnv();
  return KIWIFY_PARTNER_ID ?? null;
}
