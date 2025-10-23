import { getKiwifyApiEnv } from "./env";

export interface KiwifyOAuthToken {
  authorization: string;
  expiresAt: number;
}

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const DEFAULT_EXPIRATION_SECONDS = 300;

let cachedToken: KiwifyOAuthToken | null = null;
let cachedKey: string | null = null;
let inflightRequest: Promise<KiwifyOAuthToken> | null = null;

const normalizeBaseUrl = (baseUrl: string) =>
  baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

const buildCacheKey = (env: ReturnType<typeof getKiwifyApiEnv>) =>
  [
    env.KIWIFY_API_BASE_URL,
    env.KIWIFY_API_CLIENT_ID,
    env.KIWIFY_API_CLIENT_SECRET,
    env.KIWIFY_API_SCOPE ?? "",
  ].join("::");

const isTokenValid = (token: KiwifyOAuthToken) =>
  Date.now() + TOKEN_REFRESH_BUFFER_MS < token.expiresAt;

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseTokenResponse = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta inesperada ao solicitar token da API da Kiwify.");
  }

  const record = payload as Record<string, unknown>;
  const accessToken = typeof record.access_token === "string" ? record.access_token : null;
  if (!accessToken) {
    throw new Error("Resposta inválida ao solicitar token da API da Kiwify.");
  }

  const expiresIn =
    coerceNumber(record.expires_in) ?? coerceNumber(record.expiresIn) ?? DEFAULT_EXPIRATION_SECONDS;
  const tokenTypeRaw = typeof record.token_type === "string" ? record.token_type : "";
  const normalizedTokenType = (() => {
    const trimmed = tokenTypeRaw.trim();
    if (!trimmed) {
      return "Bearer";
    }

    if (trimmed.toLowerCase() === "bearer") {
      return "Bearer";
    }

    return trimmed;
  })();

  const expiresAt = Date.now() + Math.max(expiresIn - 5, 1) * 1000;
  const authorization = normalizedTokenType
    ? `${normalizedTokenType} ${accessToken}`.trim()
    : accessToken;

  return { authorization, expiresAt } satisfies KiwifyOAuthToken;
};

const extractErrorMessage = (payload: unknown): string | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const messageCandidates = [
    record.error_description,
    record.errorDescription,
    record.error,
    record.message,
  ];

  for (const candidate of messageCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (Array.isArray(record.errors)) {
    const first = record.errors.find((item) => typeof item === "string" && item.trim());
    if (typeof first === "string") {
      return first.trim();
    }
  }

  return null;
};

const requestToken = async (env: ReturnType<typeof getKiwifyApiEnv>): Promise<KiwifyOAuthToken> => {
  const url = new URL("v1/oauth/token", normalizeBaseUrl(env.KIWIFY_API_BASE_URL));

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.KIWIFY_API_CLIENT_ID,
    client_secret: env.KIWIFY_API_CLIENT_SECRET,
  });

  if (env.KIWIFY_API_SCOPE) {
    body.set("scope", env.KIWIFY_API_SCOPE);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = extractErrorMessage(payload);
    throw new Error(error ?? "Falha ao obter token da API da Kiwify.");
  }

  return parseTokenResponse(payload);
};

export const getKiwifyAccessToken = async (): Promise<KiwifyOAuthToken> => {
  const env = getKiwifyApiEnv();
  const key = buildCacheKey(env);

  if (cachedToken && cachedKey === key && isTokenValid(cachedToken)) {
    return cachedToken;
  }

  if (inflightRequest && cachedKey === key) {
    return inflightRequest;
  }

  inflightRequest = requestToken(env)
    .then((token) => {
      cachedToken = token;
      cachedKey = key;
      return token;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
};

export const invalidateKiwifyAccessToken = () => {
  cachedToken = null;
  inflightRequest = null;
  cachedKey = null;
};

export const __resetKiwifyOAuthForTesting = () => {
  invalidateKiwifyAccessToken();
};
