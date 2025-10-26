export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}

interface ErrorPayload {
  readonly code?: unknown;
  readonly error?: unknown;
}

export function buildApiError(payload: ErrorPayload | null | undefined, fallback: string): ApiError {
  const code = typeof payload?.code === 'string' ? payload.code : 'unknown_error';
  const message = typeof payload?.error === 'string' ? payload.error : fallback;
  return new ApiError(code, message);
}
