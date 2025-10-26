export function normalizeExternalId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return null;
  }

  const lower = stringValue.toLowerCase();
  if (lower === 'undefined' || lower === 'null') {
    return null;
  }

  return stringValue;
}

export function isValidExternalId(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  return normalizeExternalId(value) !== null;
}
