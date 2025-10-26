export { cn } from './ui/classnames';

export function parseBooleanFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
