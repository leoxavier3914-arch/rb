// Shared helper utilities for the Kiwify webhook route.

export function deepWalk(
  obj: any,
  visit: (k: string, v: any, path: string[]) => boolean,
  path: string[] = [],
): boolean {
  if (obj === null || obj === undefined) return false;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (deepWalk(obj[i], visit, [...path, String(i)])) return true;
    }
    return false;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (visit(k, v, [...path, k]) || deepWalk(v, visit, [...path, k])) return true;
    }
    return false;
  }
  return false;
}

export function getValueByPathCaseInsensitive(obj: any, path: string[]): any {
  let current: any = obj;

  for (const rawSegment of path) {
    if (current === null || current === undefined) return undefined;

    const segment = rawSegment.toLowerCase();

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isInteger(index) && index >= 0 && index < current.length) {
        current = current[index];
        continue;
      }
      return undefined;
    }

    if (typeof current === 'object') {
      const entries = Object.entries(current as Record<string, any>);
      const match = entries.find(([key]) => key.toLowerCase() === segment);
      if (!match) return undefined;
      current = match[1];
      continue;
    }

    return undefined;
  }

  return current;
}

export function pickByKeys(
  obj: any,
  keys: string[],
  test?: (v: any) => boolean,
): any | null {
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const pathKeys = keys
    .map((key) => key.trim())
    .filter((key) => key.includes('.'))
    .map((key) => key.split('.').filter(Boolean));

  for (const path of pathKeys) {
    const value = getValueByPathCaseInsensitive(obj, path);
    if (value !== undefined && (test ? test(value) : value != null)) {
      return value;
    }
  }

  let found: any = null;
  deepWalk(obj, (k, v) => {
    if (
      normalizedKeys.some((key) => !key.includes('.') && k.toLowerCase() === key) &&
      (test ? test(v) : v != null)
    ) {
      found = v;
      return true;
    }
    return false;
  });
  return found;
}

