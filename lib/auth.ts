export function isAdminFromHeaders(req: Request) {
  return req.headers.get('x-admin-role') === 'true';
}

const parseAllowed = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

const matchWildcard = (host: string, pattern: string) => {
  const norm = pattern.replace(/^https?:\/\//, '');
  if (norm.startsWith('*.')) {
    const base = norm.slice(2);
    return host === base || host.endsWith('.' + base);
  }
  return host === norm;
};

const hostFromOriginLike = (value: string): string | null => {
  try {
    const url = value.includes('://') ? new URL(value) : new URL(`https://${value}`);
    return url.host.toLowerCase();
  } catch {
    return value?.toLowerCase() || null;
  }
};

const isOriginAllowed = (originHdr: string | null, hostHdr: string | null, allowedRaw: string | undefined) => {
  const allowed = parseAllowed(allowedRaw);
  if (!allowed.length) return true;

  const checkHost = (h: string | null) => {
    if (!h) return false;
    const host = h.toLowerCase();
    return allowed.some(p => matchWildcard(host, p));
  };

  if (originHdr) {
    const originHost = hostFromOriginLike(originHdr);
    if (originHost && checkHost(originHost)) return true;
  }
  if (!originHdr && hostHdr && checkHost(hostHdr)) return true;

  return false;
};

export async function assertIsAdmin(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  const internalKey = req.headers.get('x-internal-key');

  if (!isAdminFromHeaders(req)) {
    console.warn('401 NO_ADMIN', { origin, host });
    throw new Response(JSON.stringify({ error: 'not_authorized', code: 'NO_ADMIN' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (internalKey && process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return;
  }

  const allowedRaw = process.env.ALLOWED_ORIGINS;
  const ok = isOriginAllowed(origin, host, allowedRaw);
  if (!ok) {
    console.warn('403 BAD_ORIGIN', { origin, host, allowed: allowedRaw });
    throw new Response(JSON.stringify({ error: 'forbidden_origin', code: 'BAD_ORIGIN' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
}
