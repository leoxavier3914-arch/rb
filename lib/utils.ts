export { cn } from './ui/classnames';

export function parseBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function parseOptionalBoolean(value: string | null | undefined): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return parseBooleanFlag(value, false);
}

export function parseNumberParam(value: string | null | undefined): number | undefined {
  if (value === undefined || value === null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
