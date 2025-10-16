export function formatCurrency(
  amount: number | string | null | undefined,
  currency?: string | null,
) {
  if (amount === null || amount === undefined) {
    return null;
  }

  const numericValue = typeof amount === "string" ? Number(amount) : amount;

  if (numericValue === null || numericValue === undefined || Number.isNaN(numericValue)) {
    return null;
  }

  const code = currency ?? "BRL";
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
  });

  return formatter.format(numericValue);
}

export function formatDate(date: string | null | undefined) {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  } catch (error) {
    console.warn("Data inválida recebida", date, error);
    return null;
  }
}
