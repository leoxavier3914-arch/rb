const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2
});

export function formatMoneyFromCents(valueInCents: number | null | undefined): string {
  const amount = typeof valueInCents === 'number' ? valueInCents / 100 : 0;
  return brlFormatter.format(amount);
}

export function formatShortDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}
