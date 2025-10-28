const DEFAULT_BASE_URL = 'https://public-api.kiwify.com';

function normalize(raw?: string | null): string {
  if (!raw) {
    return DEFAULT_BASE_URL;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return DEFAULT_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
}

function hasVersionSuffix(url: string): { matched: boolean; version: string | null } {
  const match = url.match(/\/(v\d+)$/);
  if (!match) {
    return { matched: false, version: null };
  }
  return { matched: true, version: match[1] };
}

function extractPathVersion(path: string): { matched: boolean; version: string | null; rest: string } {
  const match = path.match(/^\/(v\d+)\b/);
  if (!match) {
    return { matched: false, version: null, rest: path };
  }
  const rest = path.slice(match[0].length) || '/';
  return { matched: true, version: match[1], rest };
}

export function resolveApiUrl(rawBaseUrl: string | undefined, path: string): string {
  const baseUrl = normalize(rawBaseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseVersion = hasVersionSuffix(baseUrl);
  const pathVersion = extractPathVersion(normalizedPath);

  if (baseVersion.matched) {
    if (pathVersion.matched && pathVersion.version === baseVersion.version) {
      return `${baseUrl}${pathVersion.rest}`;
    }
    return `${baseUrl}${normalizedPath}`;
  }

  if (pathVersion.matched) {
    return `${baseUrl}${normalizedPath}`;
  }

  return `${baseUrl}/v1${normalizedPath}`;
}

export function resolveTokenUrl(rawBaseUrl: string | undefined): string {
  return resolveApiUrl(rawBaseUrl, '/oauth/token');
}
