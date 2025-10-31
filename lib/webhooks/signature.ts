import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface SignatureCandidate {
  readonly algorithm: string | null;
  readonly signature: string;
}

const DEFAULT_SIGNATURE_ALGORITHMS = ['sha256', 'sha1', 'sha512'] as const;

export function inferWebhookTokenFromSignature(options: {
  readonly headers: Record<string, string>;
  readonly rawBody: string;
  readonly knownTokens: readonly string[];
}): string | null {
  const signatures = extractSignatureCandidates(options.headers);
  if (signatures.length === 0) {
    return null;
  }

  const tokens = Array.from(
    new Set(
      options.knownTokens
        .map(token => (typeof token === 'string' ? token.trim() : ''))
        .filter((token): token is string => token.length > 0)
    )
  );

  if (tokens.length === 0) {
    return null;
  }

  const rawBody = typeof options.rawBody === 'string' ? options.rawBody : '';

  for (const { algorithm, signature } of signatures) {
    const normalizedSignature = signature.trim();
    if (!normalizedSignature) {
      continue;
    }

    const algorithmsToTry = algorithm ? [algorithm] : DEFAULT_SIGNATURE_ALGORITHMS;

    for (const candidateAlgorithm of algorithmsToTry) {
      const normalizedAlgorithm = normalizeAlgorithm(candidateAlgorithm);
      if (!normalizedAlgorithm) {
        continue;
      }

      for (const token of tokens) {
        const digests = generateCandidateDigests(normalizedAlgorithm, token, rawBody);
        for (const digest of digests) {
          if (matchesDigest(digest, normalizedSignature)) {
            return token;
          }
        }
      }
    }
  }

  return null;
}

export function extractSignatureCandidates(headers: Record<string, string>): SignatureCandidate[] {
  const candidates = new Map<string, SignatureCandidate>();

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'string') {
      continue;
    }

    if (!key || !key.toLowerCase().includes('signature')) {
      continue;
    }

    for (const candidate of parseSignatureValue(value)) {
      const signatureKey = `${candidate.algorithm ?? ''}|${candidate.signature}`;
      if (!candidates.has(signatureKey)) {
        candidates.set(signatureKey, candidate);
      }
    }
  }

  return Array.from(candidates.values());
}

function parseSignatureValue(value: string): SignatureCandidate[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const entries: SignatureCandidate[] = [];

  for (const match of trimmed.matchAll(/([A-Za-z0-9_-]+)\s*=\s*([^,;]+)/g)) {
    const algorithm = match[1]?.trim().toLowerCase() ?? '';
    const signature = match[2]?.trim() ?? '';
    if (!signature) {
      continue;
    }
    entries.push({ algorithm: algorithm || null, signature });
  }

  if (entries.length === 0) {
    entries.push({ algorithm: null, signature: trimmed });
  }

  return entries;
}

function normalizeAlgorithm(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('hmac-')) {
    return trimmed.slice(5);
  }

  if (trimmed === 'hmac') {
    return 'sha256';
  }

  return trimmed;
}

function generateCandidateDigests(algorithm: string, token: string, rawBody: string): Buffer[] {
  const digests = new Map<string, Buffer>();

  const pushDigest = (buffer: Buffer) => {
    const hex = buffer.toString('hex');
    if (!digests.has(hex)) {
      digests.set(hex, buffer);
    }
  };

  try {
    const hmac = createHmac(algorithm, token);
    hmac.update(rawBody, 'utf8');
    pushDigest(hmac.digest());
  } catch (error) {
    // ignore unsupported algorithms for HMAC
  }

  const sources = new Set<string>([
    token,
    `${token}${rawBody}`,
    `${rawBody}${token}`,
    `${token}:${rawBody}`,
    `${rawBody}:${token}`
  ]);

  for (const source of sources) {
    try {
      const hash = createHash(algorithm);
      hash.update(source, 'utf8');
      pushDigest(hash.digest());
    } catch (error) {
      // ignore unsupported algorithms for hash
    }
  }

  return Array.from(digests.values());
}

function matchesDigest(digest: Buffer, signature: string): boolean {
  const normalizedSignature = signature.trim();
  if (!normalizedSignature) {
    return false;
  }

  const lowercaseSignature = normalizedSignature.toLowerCase();

  const hex = digest.toString('hex');
  if (hex.length === lowercaseSignature.length && safeEquals(hex, lowercaseSignature)) {
    return true;
  }

  const upperHex = hex.toUpperCase();
  if (upperHex.length === normalizedSignature.length && safeEquals(upperHex, normalizedSignature)) {
    return true;
  }

  const base64 = digest.toString('base64');
  if (base64.length === normalizedSignature.length && safeEquals(base64, normalizedSignature)) {
    return true;
  }

  const base64NoPadding = base64.replace(/=+$/, '');
  if (base64NoPadding.length === normalizedSignature.length && safeEquals(base64NoPadding, normalizedSignature)) {
    return true;
  }

  const base64Url = digest.toString('base64url');
  if (base64Url.length === normalizedSignature.length && safeEquals(base64Url, normalizedSignature)) {
    return true;
  }

  const base64UrlNoPadding = base64Url.replace(/=+$/, '');
  if (base64UrlNoPadding.length === normalizedSignature.length && safeEquals(base64UrlNoPadding, normalizedSignature)) {
    return true;
  }

  return false;
}

function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

