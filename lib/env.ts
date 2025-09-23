export function readEnvValue(name: string, ...fallbacks: string[]): string | null {
  const candidates = [name, ...fallbacks];
  for (const candidate of candidates) {
    const value = process.env[candidate];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}
