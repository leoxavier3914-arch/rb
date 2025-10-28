'use client';

interface ApiPayload {
  readonly ok?: boolean;
  readonly error?: string;
  readonly data?: unknown;
}

function normalizeError(payload: ApiPayload | null, fallbackMessage: string): string {
  if (!payload) {
    return fallbackMessage;
  }
  const message = typeof payload.error === 'string' ? payload.error.trim() : '';
  return message !== '' ? message : fallbackMessage;
}

function buildHeaders(initHeaders: HeadersInit | undefined): Headers {
  const headers = new Headers(initHeaders);
  headers.set('x-admin-role', 'true');
  return headers;
}

export async function callKiwifyAdminApi(
  url: string,
  options: RequestInit = {},
  fallbackMessage = 'Erro ao executar operação.'
): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers)
  });

  if (response.status === 204 || response.status === 205) {
    return null;
  }

  let payload: ApiPayload | null = null;
  try {
    payload = (await response.json()) as ApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(normalizeError(payload, fallbackMessage));
  }

  return payload.data ?? null;
}
