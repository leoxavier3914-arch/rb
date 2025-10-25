import { NextRequest } from 'next/server';
import { getAllowedOrigins } from './env';

const ADMIN_HEADER = 'x-admin-role';
const INTERNAL_KEY_HEADER = 'x-internal-key';

export interface AdminAssertionOptions {
  readonly requireInternalKey?: boolean;
}

export function assertIsAdmin(request: NextRequest, options: AdminAssertionOptions = {}): void {
  const adminFlag = request.headers.get(ADMIN_HEADER);
  if (adminFlag !== 'true') {
    throw createAuthError(401, 'NO_ADMIN', 'not_authorized');
  }

  if (options.requireInternalKey) {
    const internalKey = request.headers.get(INTERNAL_KEY_HEADER);
    if (!internalKey) {
      throw createAuthError(401, 'NO_INTERNAL_KEY', 'not_authorized');
    }
  }

  const originHeader = request.headers.get('origin');
  const hostHeader = request.headers.get('host');
  const allowed = getAllowedOrigins();

  if (allowed.length === 0) {
    return;
  }

  const normalizedOrigin = normalizeOrigin(originHeader ?? hostHeader ?? '');
  if (!normalizedOrigin) {
    const meta = { origin: originHeader, host: hostHeader, allowed };
    logForbidden(meta);
    throw createAuthError(403, 'BAD_ORIGIN', 'forbidden_origin', meta);
  }

  const isAllowed = allowed.some((entry) => matchesOrigin(entry, normalizedOrigin));
  if (!isAllowed) {
    const meta = { origin: normalizedOrigin, host: hostHeader, allowed };
    logForbidden(meta);
    throw createAuthError(403, 'BAD_ORIGIN', 'forbidden_origin', meta);
  }
}

function normalizeOrigin(origin: string): string | null {
  if (!origin) {
    return null;
  }
  try {
    if (origin.includes('://')) {
      return new URL(origin).host;
    }
    return origin;
  } catch {
    return null;
  }
}

function matchesOrigin(entry: string, origin: string): boolean {
  if (entry === origin) {
    return true;
  }
  if (!entry.includes('*')) {
    try {
      const url = entry.includes('://') ? new URL(entry).host : entry;
      return url === origin;
    } catch {
      return false;
    }
  }

  if (!entry.startsWith('*.')) {
    return false;
  }

  const domain = entry.slice(2);
  return origin === domain || origin.endsWith(`.${domain}`);
}

function logForbidden(meta: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      level: 'warn',
      event: 'auth_denied',
      code: 'BAD_ORIGIN',
      ...meta
    })
  );
}

export function createAuthError(
  status: number,
  code: string,
  error: string,
  meta?: Record<string, unknown>
): never {
  const responseBody: Record<string, unknown> = {
    ok: false,
    code,
    error
  };

  if (meta) {
    responseBody.meta = meta;
  }

  throw new Response(JSON.stringify(responseBody), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
