const MAX_PAGE_SIZE = 100;

export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
}

export function parsePagination(params: URLSearchParams, defaultPageSize = 20): PaginationOptions {
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const pageSizeRaw = Number.parseInt(params.get('page_size') ?? String(defaultPageSize), 10) || defaultPageSize;
  const pageSize = Math.min(Math.max(1, pageSizeRaw), MAX_PAGE_SIZE);
  return { page, pageSize };
}

export interface DateFilters {
  readonly from?: Date | null;
  readonly to?: Date | null;
}

export function parseDateFilters(params: URLSearchParams): DateFilters {
  const from = parseDate(params.get('date_from'));
  const to = parseDate(params.get('date_to'));
  return { from: from ?? undefined, to: to ?? undefined };
}

export function buildDateClause(filters: DateFilters, paidColumn = 'paid_at', createdColumn = 'created_at'): string | null {
  const fromIso = filters.from?.toISOString();
  const toIso = filters.to?.toISOString();
  if (!fromIso && !toIso) {
    return null;
  }

  const clauses: string[] = [];
  const range: string[] = [];

  if (fromIso) {
    range.push(`${paidColumn}.gte.${fromIso}`);
  }
  if (toIso) {
    range.push(`${paidColumn}.lte.${toIso}`);
  }
  if (range.length > 0) {
    clauses.push(`and(${range.join(',')})`);
  }

  const createdRange: string[] = [`${paidColumn}.is.null`];
  if (fromIso) {
    createdRange.push(`${createdColumn}.gte.${fromIso}`);
  }
  if (toIso) {
    createdRange.push(`${createdColumn}.lte.${toIso}`);
  }
  clauses.push(`and(${createdRange.join(',')})`);

  return clauses.join(',');
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp);
}
