import { Buffer } from "node:buffer";

import { getKiwifyApiEnv, hasKiwifyApiEnv } from "@/lib/env";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const DEFAULT_API_PATH_PREFIX = "/v1";

const TOKEN_CACHE_KEY = "__kiwifyApiTokenCache";
const ACCOUNT_ID_HEADER = "x-kiwify-account-id";

type KiwifyApiEnvValues = ReturnType<typeof getKiwifyApiEnv>;
type KiwifyApiConfig = Pick<KiwifyApiEnvValues, "KIWIFY_API_BASE_URL" | "KIWIFY_API_PATH_PREFIX">;

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
  accountId?: string;
  alternativeAccountId?: string;
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

const updateTokenCache = (updater: (entry: TokenCacheEntry) => TokenCacheEntry | void) => {
  const current = ensureTokenCache();

  if (!current) {
    return;
  }

  const result = updater(current);

  if (result) {
    saveTokenCache(result);
  } else {
    saveTokenCache(current);
  }
};

const clearCachedAccountId = (token?: TokenCacheEntry | null) => {
  if (token) {
    token.accountId = undefined;
    token.alternativeAccountId = undefined;
  }

  updateTokenCache((entry) => {
    entry.accountId = undefined;
    entry.alternativeAccountId = undefined;
  });
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

const splitPathSegments = (value: string | undefined) => {
  if (!value) {
    return [] as string[];
  }

  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const joinPathSegments = (segments: string[]) => {
  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
};

const normalizeApiPathPrefix = (prefix?: string) => {
  if (prefix === undefined) {
    return DEFAULT_API_PATH_PREFIX;
  }

  const trimmed = prefix.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
};

type BuildKiwifyApiUrlOptions = {
  includePrefix?: boolean;
};

const buildKiwifyApiUrl = (
  path: string,
  env?: KiwifyApiConfig,
  options: BuildKiwifyApiUrlOptions = {},
) => {
  const config = env ?? getKiwifyApiEnv();
  const trimmedPath = path.trim();
  const { includePrefix = true } = options;

  if (ABSOLUTE_URL_PATTERN.test(trimmedPath)) {
    return new URL(trimmedPath);
  }

  const baseUrl = new URL(config.KIWIFY_API_BASE_URL);
  baseUrl.search = "";
  baseUrl.hash = "";

  if (trimmedPath.startsWith("/")) {
    const segments = splitPathSegments(trimmedPath);
    baseUrl.pathname = joinPathSegments(segments);
    return baseUrl;
  }

  const prefix = includePrefix
    ? normalizeApiPathPrefix(config.KIWIFY_API_PATH_PREFIX)
    : "";
  const segments = [
    ...splitPathSegments(prefix),
    ...splitPathSegments(trimmedPath),
  ];

  baseUrl.pathname = joinPathSegments(segments);
  return baseUrl;
};

async function requestAccessToken(forceRefresh = false): Promise<TokenCacheEntry> {
  if (!hasKiwifyApiEnv()) {
    throw new Error("As variáveis de ambiente da API da Kiwify não estão configuradas.");
  }

  const cached = ensureTokenCache();

  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 30_000) {
    return cached;
  }

  const env = getKiwifyApiEnv();

  const {
    KIWIFY_API_CLIENT_ID,
    KIWIFY_API_CLIENT_SECRET,
    KIWIFY_API_SCOPE,
    KIWIFY_API_AUDIENCE,
  } = env;

  const createPayload = () => {
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

    return payload;
  };

  let tokenUrl = buildKiwifyApiUrl("oauth/token", env, { includePrefix: false });
  let response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: createPayload(),
    cache: "no-store",
  });

  if (response.status === 404) {
    const prefixedTokenUrl = buildKiwifyApiUrl("oauth/token", env);

    if (prefixedTokenUrl.toString() !== tokenUrl.toString()) {
      tokenUrl = prefixedTokenUrl;
      response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: createPayload(),
        cache: "no-store",
      });
    }
  }

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
    account_id?: unknown;
    account?: unknown;
    user?: { account_id?: unknown; account?: unknown } | null;
  };

  const resolveAccountId = (value: unknown): string | undefined => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "object") {
      const candidate = (value as { id?: unknown; account_id?: unknown }).id ??
        (value as { id?: unknown; account_id?: unknown }).account_id;

      return resolveAccountId(candidate);
    }

    return undefined;
  };

  const decodeJwtPayload = (token: unknown): unknown => {
    if (typeof token !== "string" || token.length === 0) {
      return undefined;
    }

    const [, payload] = token.split(".");

    if (!payload) {
      return undefined;
    }

    try {
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
      const decoded = Buffer.from(padded, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch (error) {
      console.warn("Não foi possível interpretar o payload do token JWT da Kiwify", error);
      return undefined;
    }
  };

  const resolveAccountIdFromJwt = (token: unknown): string | undefined => {
    const payload = decodeJwtPayload(token);

    if (!payload || typeof payload !== "object") {
      return undefined;
    }

    const candidate =
      (payload as { account_id?: unknown }).account_id ??
      (payload as { account?: unknown }).account ??
      (payload as { user?: { account_id?: unknown; account?: unknown } }).user?.account_id ??
      (payload as { user?: { account_id?: unknown; account?: unknown } }).user?.account;

    return resolveAccountId(candidate);
  };

  const resolvedAccountIdFromResponse =
    resolveAccountId(tokenResponse.account_id) ??
    // Fallbacks observed in the live OAuth token payload: a nested "account" object
    // as well as the legacy "user.account_id" field exposed for backwards compatibility.
    resolveAccountId(tokenResponse.account) ??
    resolveAccountId(tokenResponse.user?.account_id) ??
    resolveAccountId(tokenResponse.user?.account);

  const resolvedAccountIdFromJwt = resolveAccountIdFromJwt(tokenResponse.access_token);

  const accountIdCandidates = [
    resolvedAccountIdFromResponse,
    resolvedAccountIdFromJwt,
  ].filter((candidate): candidate is string => typeof candidate === "string");

  const primaryAccountId = accountIdCandidates[0];
  const secondaryAccountId = accountIdCandidates.find(
    (candidate) => candidate !== primaryAccountId,
  );

  const now = Date.now();
  const expiresAt = now + Math.max(0, (tokenResponse.expires_in - 60) * 1000);
  const entry: TokenCacheEntry = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    obtainedAt: now,
    expiresAt,
    accountId: primaryAccountId,
    alternativeAccountId: secondaryAccountId,
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

  const env = getKiwifyApiEnv();
  const url = buildKiwifyApiUrl(path, env);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === null || value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(customHeaders);

  const partnerId = env.KIWIFY_PARTNER_ID ?? undefined;
  if (partnerId && !headers.has("x-kiwify-partner-id")) {
    headers.set("x-kiwify-partner-id", partnerId);
  }

  let token: TokenCacheEntry | null = null;

  if (!skipAuth) {
    token = await requestAccessToken();
    headers.set("Authorization", `${token.tokenType} ${token.accessToken}`);
    if (token.accountId) {
      headers.set(ACCOUNT_ID_HEADER, token.accountId);
    } else {
      headers.delete(ACCOUNT_ID_HEADER);
    }
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

  const shouldRetryWithoutAccountHeader = (details: unknown) => {
    if (!details || typeof details !== "object") {
      return false;
    }

    const message = (() => {
      if (typeof (details as { message?: unknown }).message === "string") {
        return (details as { message: string }).message;
      }

      if (Array.isArray(details)) {
        for (const item of details) {
          if (item && typeof item === "object") {
            const candidate = (item as { message?: unknown }).message;
            if (typeof candidate === "string") {
              return candidate;
            }
          }
        }
      }

      return undefined;
    })();

    if (!message) {
      return false;
    }

    return message.toLowerCase().includes("account_id mismatch");
  };

  const tryAlternativeAccountId = async () => {
    if (!token) {
      return null;
    }

    const currentAccountId = headers.get(ACCOUNT_ID_HEADER) ?? undefined;
    const alternativeAccountId =
      token.alternativeAccountId && token.alternativeAccountId !== currentAccountId
        ? token.alternativeAccountId
        : undefined;

    if (!alternativeAccountId) {
      return null;
    }

    headers.set(ACCOUNT_ID_HEADER, alternativeAccountId);

    const alternativeResponse = await fetch(url, {
      ...init,
      headers,
    });

    if (alternativeResponse.ok) {
      if (token) {
        const previousAccountId = token.accountId;
        token.accountId = alternativeAccountId;
        token.alternativeAccountId =
          previousAccountId && previousAccountId !== alternativeAccountId
            ? previousAccountId
            : undefined;
      }

      updateTokenCache((entry) => {
        const previousAccountId = entry.accountId;
        entry.accountId = alternativeAccountId;
        entry.alternativeAccountId =
          previousAccountId && previousAccountId !== alternativeAccountId
            ? previousAccountId
            : undefined;
      });

      return alternativeResponse;
    }

    if (currentAccountId) {
      headers.set(ACCOUNT_ID_HEADER, currentAccountId);
    } else {
      headers.delete(ACCOUNT_ID_HEADER);
    }

    return alternativeResponse;
  };

  if (response.status === 401 && !skipAuth) {
    await invalidateCachedToken();
    const refreshedToken = await requestAccessToken(true);
    token = refreshedToken;
    headers.set("Authorization", `${refreshedToken.tokenType} ${refreshedToken.accessToken}`);
    if (refreshedToken.accountId) {
      headers.set(ACCOUNT_ID_HEADER, refreshedToken.accountId);
    } else {
      headers.delete(ACCOUNT_ID_HEADER);
    }
    const retryResponse = await fetch(url, {
      ...init,
      headers,
    });

    if (!retryResponse.ok) {
      const errorDetails = await safeParseBody(retryResponse);

      if (shouldRetryWithoutAccountHeader(errorDetails) && headers.has(ACCOUNT_ID_HEADER)) {
        const alternativeResponse = await tryAlternativeAccountId();

        if (alternativeResponse && alternativeResponse.ok) {
          return (await safeParseResponse<T>(alternativeResponse)) as T;
        }

        headers.delete(ACCOUNT_ID_HEADER);
        clearCachedAccountId(token);

        const fallbackResponse = await fetch(url, {
          ...init,
          headers,
        });

        if (!fallbackResponse.ok) {
          const fallbackErrorDetails = await safeParseBody(fallbackResponse);
          throw new KiwifyApiError("Falha ao consultar a API da Kiwify.", fallbackResponse.status, {
            method,
            url: url.toString(),
          }, fallbackErrorDetails);
        }

        return (await safeParseResponse<T>(fallbackResponse)) as T;
      }

      throw new KiwifyApiError("Falha ao consultar a API da Kiwify.", retryResponse.status, {
        method,
        url: url.toString(),
      }, errorDetails);
    }

    return (await safeParseResponse<T>(retryResponse)) as T;
  }

  if (!response.ok) {
    const errorDetails = await safeParseBody(response);

    if (!skipAuth && shouldRetryWithoutAccountHeader(errorDetails) && headers.has(ACCOUNT_ID_HEADER)) {
      const alternativeResponse = await tryAlternativeAccountId();

      if (alternativeResponse && alternativeResponse.ok) {
        return (await safeParseResponse<T>(alternativeResponse)) as T;
      }

      headers.delete(ACCOUNT_ID_HEADER);
      clearCachedAccountId(token);

      const fallbackResponse = await fetch(url, {
        ...init,
        headers,
      });

      if (!fallbackResponse.ok) {
        const fallbackErrorDetails = await safeParseBody(fallbackResponse);
        throw new KiwifyApiError("Falha ao consultar a API da Kiwify.", fallbackResponse.status, {
          method,
          url: url.toString(),
        }, fallbackErrorDetails);
      }

      return (await safeParseResponse<T>(fallbackResponse)) as T;
    }

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

export function getKiwifyApiPathPrefix() {
  if (!hasKiwifyApiEnv()) {
    return DEFAULT_API_PATH_PREFIX;
  }

  const { KIWIFY_API_PATH_PREFIX } = getKiwifyApiEnv();
  return normalizeApiPathPrefix(KIWIFY_API_PATH_PREFIX);
}

export function formatKiwifyApiPath(resource: string) {
  const prefix = getKiwifyApiPathPrefix();
  const segments = [
    ...splitPathSegments(prefix),
    ...splitPathSegments(resource),
  ];

  return joinPathSegments(segments);
}
