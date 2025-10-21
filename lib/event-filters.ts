export interface EventFilterParams {
  from?: string;
  to?: string;
  q?: string;
}

export interface ParsedEventFilters {
  filters: {
    startDate?: string;
    endDate?: string;
    search?: string;
  };
  values: {
    from?: string;
    to?: string;
    search?: string;
  };
}

const isDateOnly = (value: string) => /\d{4}-\d{2}-\d{2}/.test(value);

const toIsoRange = (value: string, endOfDay: boolean) => {
  if (!isDateOnly(value)) {
    return undefined;
  }

  const base = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) {
    return undefined;
  }

  if (endOfDay) {
    base.setUTCDate(base.getUTCDate() + 1);
    base.setUTCMilliseconds(base.getUTCMilliseconds() - 1);
  }

  return base.toISOString();
};

const extractParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const parseEventFilters = (
  searchParams: Record<string, string | string[] | undefined>,
): ParsedEventFilters => {
  const fromParam = extractParam(searchParams.from);
  const toParam = extractParam(searchParams.to);
  const queryParam = extractParam(searchParams.q);

  const sanitizedQuery = queryParam?.trim();

  return {
    filters: {
      startDate: fromParam ? toIsoRange(fromParam, false) : undefined,
      endDate: toParam ? toIsoRange(toParam, true) : undefined,
      search: sanitizedQuery ? sanitizedQuery : undefined,
    },
    values: {
      from: fromParam && isDateOnly(fromParam) ? fromParam : undefined,
      to: toParam && isDateOnly(toParam) ? toParam : undefined,
      search: sanitizedQuery,
    },
  };
};

