import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(valueInCents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(valueInCents / 100);
}

export function formatPercentage(value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
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
