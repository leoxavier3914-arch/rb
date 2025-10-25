import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const numberFormatters = new Map<string, Intl.NumberFormat>();

function serializeOptions(options: Intl.NumberFormatOptions) {
  return Object.entries(options)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join("|");
}

function getNumberFormatter(locale: string, options: Intl.NumberFormatOptions) {
  const cacheKey = `${locale}-${serializeOptions(options)}`;
  let formatter = numberFormatters.get(cacheKey);

  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(cacheKey, formatter);
  }

  return formatter;
}

export function formatCurrency(valueInCents: number, currency = "BRL") {
  return getNumberFormatter("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(valueInCents / 100);
}

export function formatPercentage(value: number, options: Intl.NumberFormatOptions = {}) {
  const { maximumFractionDigits, minimumFractionDigits, ...rest } = options;

  return getNumberFormatter("pt-BR", {
    style: "percent",
    maximumFractionDigits: maximumFractionDigits ?? 1,
    minimumFractionDigits: minimumFractionDigits ?? 0,
    ...rest,
  }).format(value);
}

export function formatDate(date: Date | string) {
  return format(typeof date === "string" ? new Date(date) : date, "dd MMM yyyy", {
    locale: ptBR,
  });
}

export function formatDateTime(date: Date | string) {
  return format(typeof date === "string" ? new Date(date) : date, "dd/MM/yyyy HH:mm", {
    locale: ptBR,
  });
}
