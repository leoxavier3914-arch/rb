const formatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const normalized = currency.toUpperCase();
  if (formatterCache.has(normalized)) {
    return formatterCache.get(normalized)!;
  }
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: normalized,
    minimumFractionDigits: 2
  });
  formatterCache.set(normalized, formatter);
  return formatter;
}

export function formatMoneyFromCents(valueInCents: number | null | undefined): string {
  return formatMoneyFromCentsWithCurrency(valueInCents, 'BRL');
}

export function formatMoneyFromCentsWithCurrency(
  valueInCents: number | null | undefined,
  currency: string
): string {
  const amount = typeof valueInCents === 'number' ? valueInCents / 100 : 0;
  return getCurrencyFormatter(currency).format(amount);
}

export function formatShortDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }).format(date);
}

export function formatShortDateUTC(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function formatDateTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  }).format(date);
}
