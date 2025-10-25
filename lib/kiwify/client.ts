import { getKiwifyApiEnv, hasKiwifyApiEnv } from "@/lib/env";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const DEFAULT_API_PATH_PREFIX = "/v1";

const TOKEN_CACHE_KEY = "__kiwifyApiTokenCache";
const ACCOUNT_ID_HEADER = "x-kiwify-account-id";
const TOKEN_STORAGE_TABLE = "kfy_tokens";
const TOKEN_STORAGE_PRIMARY_KEY = "id";
const TOKEN_STORAGE_ROW_ID = "primary";

type KiwifyApiConfig = Pick<ReturnType<typeof getKiwifyApiEnv>, "KIWIFY_API_BASE_URL">;

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

let storageLoadPromise: Promise<TokenCacheEntry | null> | null = null;
let storageLoaded = false;

export interface KiwifyAccessTokenMetadata {
  tokenType: string | null;
  scope?: string | null;
  expiresAt: string | null;
  obtainedAt: string | null;
  preview: string;
  hasToken: boolean;
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

const parseStorageTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return Date.now();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const loadTokenFromStorage = async (): Promise<TokenCacheEntry | null> => {
  if (storageLoaded) {
    return ensureTokenCache();
  }

  if (!storageLoadPromise) {
    storageLoadPromise = (async () => {
      if (!hasSupabaseConfig()) {
        storageLoaded = true;
        return null;
      }

      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from(TOKEN_STORAGE_TABLE)
          .select("token, token_type, scope, expires_at, updated_at")
          .eq(TOKEN_STORAGE_PRIMARY_KEY, TOKEN_STORAGE_ROW_ID)
          .maybeSingle();

        if (error) {
          console.warn("Não foi possível carregar token da Kiwify armazenado", error);
          return null;
        }

        if (!data?.token || !data.expires_at) {
          return null;
        }

        const expiresAt = Date.parse(data.expires_at);

        if (Number.isNaN(expiresAt) || expiresAt <= Date.now() + 120_000) {
          return null;
        }

        const entry: TokenCacheEntry = {
          accessToken: data.token,
          tokenType: data.token_type ?? "Bearer",
          scope: data.scope ?? undefined,
          expiresAt,
          obtainedAt: parseStorageTimestamp(data.updated_at ?? data.expires_at),
        };

        saveTokenCache(entry);
        return entry;
      } catch (error) {
        console.warn("Erro inesperado ao consultar armazenamento de tokens da Kiwify", error);
        return null;
      } finally {
        storageLoaded = true;
        storageLoadPromise = null;
      }
    })();
  }

  return storageLoadPromise;
};

const persistTokenToStorage = async (entry: TokenCacheEntry) => {
  if (!hasSupabaseConfig()) {
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(TOKEN_STORAGE_TABLE)
      .upsert(
        {
          [TOKEN_STORAGE_PRIMARY_KEY]: TOKEN_STORAGE_ROW_ID,
          token: entry.accessToken,
          token_type: entry.tokenType,
          scope: entry.scope ?? null,
          expires_at: new Date(entry.expiresAt).toISOString(),
          updated_at: new Date(entry.obtainedAt).toISOString(),
        },
        { onConflict: TOKEN_STORAGE_PRIMARY_KEY },
      );

    if (error) {
      console.warn("Falha ao persistir token da Kiwify no Supabase", error);
    }
  } catch (error) {
    console.warn("Erro inesperado ao persistir token da Kiwify", error);
  }
};

const formatMetadataFromEntry = (entry: TokenCacheEntry | null): KiwifyAccessTokenMetadata => {
  if (!entry) {
    return {
      tokenType: null,
      scope: null,
      expiresAt: null,
      obtainedAt: null,
      preview: "",
      hasToken: false,
    };
  }

  return {
    tokenType: entry.tokenType,
    scope: entry.scope ?? null,
    expiresAt: new Date(entry.expiresAt).toISOString(),
    obtainedAt: new Date(entry.obtainedAt).toISOString(),
    preview: buildTokenPreview(entry.accessToken),
    hasToken: Boolean(entry.accessToken),
  };
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

  const prefix = includePrefix ? DEFAULT_API_PATH_PREFIX : "";
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

  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 120_000) {
    return cached;
  }

  if (!forceRefresh) {
    const stored = await loadTokenFromStorage();

    if (stored && stored.expiresAt > Date.now() + 120_000) {
      return stored;
    }
  }

  const env = getKiwifyApiEnv();

  const { KIWIFY_CLIENT_ID, KIWIFY_CLIENT_SECRET, KIWIFY_API_SCOPE, KIWIFY_API_AUDIENCE } = env;

  const createPayload = () => {
    const payload = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: KIWIFY_CLIENT_ID,
      client_secret: KIWIFY_CLIENT_SECRET,
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
  };

  const now = Date.now();
  const expiresAt = now + Math.max(0, (tokenResponse.expires_in - 120) * 1000);
  const entry: TokenCacheEntry = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    obtainedAt: now,
    expiresAt,
  };

  saveTokenCache(entry);
  storageLoaded = false;
  await persistTokenToStorage(entry);
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
  if (forceRefresh) {
    const entry = await requestAccessToken(true);
    return formatMetadataFromEntry(entry);
  }

  const cached = ensureTokenCache();
  if (cached) {
    return formatMetadataFromEntry(cached);
  }

  const stored = await loadTokenFromStorage();
  return formatMetadataFromEntry(stored);
}

export async function invalidateCachedToken() {
  saveTokenCache(null);
  storageLoaded = false;
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  const entry = await requestAccessToken(forceRefresh);
  return entry.accessToken;
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
  const accountId = env.KIWIFY_ACCOUNT_ID?.trim();
  if (accountId && !headers.has(ACCOUNT_ID_HEADER)) {
    headers.set(ACCOUNT_ID_HEADER, accountId);
  }
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
    const refreshedToken = await requestAccessToken(true);
    headers.set("Authorization", `${refreshedToken.tokenType} ${refreshedToken.accessToken}`);

    const retryResponse = await fetch(url, {
      ...init,
      headers,
    });

    if (!retryResponse.ok) {
      const errorDetails = await safeParseBody(retryResponse);
      logKiwifyError(method, url, retryResponse.status, errorDetails);
      throw new KiwifyApiError("Falha ao consultar a API da Kiwify.", retryResponse.status, {
        method,
        url: url.toString(),
      }, errorDetails);
    }

    return (await safeParseResponse<T>(retryResponse)) as T;
  }

  if (!response.ok) {
    const errorDetails = await safeParseBody(response);
    logKiwifyError(method, url, response.status, errorDetails);

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

export function getKiwifyApiPathPrefix() {
  return DEFAULT_API_PATH_PREFIX;
}

export function formatKiwifyApiPath(resource: string) {
  const segments = [
    ...splitPathSegments(DEFAULT_API_PATH_PREFIX),
    ...splitPathSegments(resource),
  ];

  return joinPathSegments(segments);
}

function logKiwifyError(method: string, url: URL, status: number, details: unknown) {
  const summary = typeof details === "string" ? details : JSON.stringify(details ?? {});
  console.error("Kiwify API request failed", {
    method,
    url: url.toString(),
    status,
    details: summary?.slice(0, 300),
  });
}
