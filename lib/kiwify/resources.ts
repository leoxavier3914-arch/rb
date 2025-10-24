import { addDays, formatISO, isAfter, parseISO } from "date-fns";

import { kiwifyFetch } from "@/lib/kiwify/client";

const MAX_SALES_RANGE_DAYS = 90;

const MAX_SALES_PAGE_SIZE = 100;

const formatDateParam = (date: Date) => formatISO(date, { representation: "date" });

const toPositiveInteger = (value: number | undefined, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
};

const normalizeSalesPageSize = (value: number | undefined) => {
  const normalized = toPositiveInteger(value, MAX_SALES_PAGE_SIZE);
  return Math.min(normalized, MAX_SALES_PAGE_SIZE);
};

const parseDateParam = (value: string, label: string): Date => {
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label}: expected an ISO date string (yyyy-mm-dd)`);
  }
  return parsed;
};

const extractSalesCollection = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const container = payload as Record<string, unknown>;
  const candidateKeys = ["data", "items", "results", "sales"];

  for (const key of candidateKeys) {
    const value = container[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

const shouldRequestNextPage = (
  payload: unknown,
  currentPageSize: number,
  perPage: number,
  page: number,
): boolean => {
  if (payload && typeof payload === "object") {
    const container = payload as Record<string, unknown>;
    const meta = container.meta as Record<string, unknown> | undefined;
    const pagination = container.pagination as Record<string, unknown> | undefined;
    const links = container.links as Record<string, unknown> | undefined;

    const sources = [meta, pagination];

    for (const source of sources) {
      if (!source) continue;

      if (typeof source.has_more === "boolean") {
        return source.has_more;
      }

      if (typeof source.has_next === "boolean") {
        return source.has_next;
      }

      if (typeof source.has_next_page === "boolean") {
        return source.has_next_page;
      }

      if (typeof source.next_page === "number") {
        return source.next_page > page;
      }

      if (source.next_page != null && typeof source.next_page !== "boolean") {
        return true;
      }

      if (
        typeof source.total_pages === "number" &&
        typeof source.current_page === "number"
      ) {
        return source.current_page < source.total_pages;
      }
    }

    if (links) {
      if (links.next === null || links.next === undefined || links.next === false) {
        return false;
      }

      if (typeof links.next === "string" && links.next.trim().length === 0) {
        return false;
      }

      return true;
    }
  }

  return currentPageSize >= perPage;
};

export async function fetchAccountOverview(path = "account") {
  return kiwifyFetch<Record<string, unknown>>(path);
}

export async function listProducts(options: {
  page?: number;
  perPage?: number;
  pageNumber?: number;
  pageSize?: number;
  path?: string;
} = {}) {
  const {
    path = "products",
    page,
    perPage,
    pageNumber = page,
    pageSize = perPage,
  } = options;

  return kiwifyFetch<unknown>(path, {
    searchParams: {
      page_number: pageNumber,
      page_size: pageSize,
    },
  });
}

export async function createProduct(payload: Record<string, unknown>, path = "products") {
  return kiwifyFetch<unknown>(path, {
    method: "POST",
    body: payload,
  });
}

export async function updateProduct(
  productId: string,
  payload: Record<string, unknown>,
  options: { path?: string } = {},
) {
  const { path = "products" } = options;
  const resourcePath = `${path.replace(/\/$/, "")}/${productId}`;

  return kiwifyFetch<unknown>(resourcePath, {
    method: "PATCH",
    body: payload,
  });
}

export async function listSales(options: {
  startDate: string;
  endDate: string;
  page?: number;
  perPage?: number;
  pageNumber?: number;
  pageSize?: number;
  status?: string;
  productId?: string;
  path?: string;
}) {
  const {
    path = "sales",
    page,
    perPage,
    pageNumber = page,
    pageSize = perPage,
    status,
    startDate,
    endDate,
    productId,
  } = options;

  const resolvedPageNumber = toPositiveInteger(pageNumber, 1);
  const resolvedPageSize = normalizeSalesPageSize(pageSize ?? perPage ?? MAX_SALES_PAGE_SIZE);

  const searchParams: Record<string, string | number | undefined> = {
    page_number: resolvedPageNumber,
    page_size: resolvedPageSize,
    status,
    start_date: startDate,
    end_date: endDate,
  };

  if (productId) {
    searchParams.product_id = productId;
  }

  return kiwifyFetch<unknown>(path, {
    searchParams,
  });
}

type ListAllSalesOptions = {
  startDate: string;
  endDate?: string;
  perPage?: number;
  status?: string;
  productId?: string;
  path?: string;
};

type ListAllSalesResult = {
  summary: {
    range: {
      startDate: string;
      endDate: string;
    };
    totalIntervals: number;
    totalPages: number;
    totalSales: number;
  };
  sales: unknown[];
  requests: {
    range: {
      startDate: string;
      endDate: string;
    };
    pages: unknown[];
  }[];
};

export async function listAllSales(options: ListAllSalesOptions): Promise<ListAllSalesResult> {
  const {
    startDate,
    endDate,
    perPage: requestedPerPage = MAX_SALES_PAGE_SIZE,
    status,
    productId,
    path,
  } = options;

  if (typeof requestedPerPage === "number" && requestedPerPage <= 0) {
    throw new Error("perPage must be greater than 0");
  }

  const perPage = normalizeSalesPageSize(requestedPerPage);

  const rangeStart = parseDateParam(startDate, "startDate");
  const today = new Date();
  const rangeEnd = endDate
    ? parseDateParam(endDate, "endDate")
    : parseDateParam(formatDateParam(today), "endDate");

  if (isAfter(rangeStart, rangeEnd)) {
    throw new Error("startDate must be before or equal to endDate");
  }

  const intervals: { startDate: string; endDate: string }[] = [];
  let cursor = rangeStart;

  while (!isAfter(cursor, rangeEnd)) {
    const chunkEnd = addDays(cursor, MAX_SALES_RANGE_DAYS - 1);
    const boundedEnd = isAfter(chunkEnd, rangeEnd) ? rangeEnd : chunkEnd;

    intervals.push({
      startDate: formatDateParam(cursor),
      endDate: formatDateParam(boundedEnd),
    });

    cursor = addDays(boundedEnd, 1);
  }

  const aggregatedSales: unknown[] = [];
  const aggregatedRequests: ListAllSalesResult["requests"] = [];
  let totalPages = 0;

  for (const interval of intervals) {
    const pages: unknown[] = [];
    let page = 1;

    while (true) {
      const response = await listSales({
        startDate: interval.startDate,
        endDate: interval.endDate,
        pageNumber: page,
        pageSize: perPage,
        status,
        productId,
        path,
      });

      pages.push(response);
      totalPages += 1;

      const records = extractSalesCollection(response);
      aggregatedSales.push(...records);

      if (!shouldRequestNextPage(response, records.length, perPage, page)) {
        break;
      }

      page += 1;
    }

    aggregatedRequests.push({
      range: interval,
      pages,
    });
  }

  return {
    summary: {
      range: {
        startDate: intervals[0]?.startDate ?? formatDateParam(rangeStart),
        endDate: intervals.at(-1)?.endDate ?? formatDateParam(rangeEnd),
      },
      totalIntervals: intervals.length,
      totalPages,
      totalSales: aggregatedSales.length,
    },
    sales: aggregatedSales,
    requests: aggregatedRequests,
  };
}

export async function listAffiliates(options: {
  page?: number;
  perPage?: number;
  path?: string;
} = {}) {
  const { path = "affiliates", page, perPage } = options;

  return kiwifyFetch<unknown>(path, {
    searchParams: {
      page,
      per_page: perPage,
    },
  });
}

export async function listWebhooks(options: {
  page?: number;
  perPage?: number;
  eventType?: string;
  path?: string;
} = {}) {
  const { path = "webhooks/events", page, perPage, eventType } = options;

  return kiwifyFetch<unknown>(path, {
    searchParams: {
      page,
      per_page: perPage,
      event_type: eventType,
    },
  });
}

export async function listParticipants(options: {
  productId: string;
  page?: number;
  perPage?: number;
  status?: string;
  path?: string;
}) {
  const { productId, path = "products", page, perPage, status } = options;
  const resourcePath = `${path.replace(/\/$/, "")}/${productId}/participants`;

  return kiwifyFetch<unknown>(resourcePath, {
    searchParams: {
      page,
      per_page: perPage,
      status,
    },
  });
}

export async function listWebhooksDeliveries(options: {
  page?: number;
  perPage?: number;
  status?: string;
  path?: string;
} = {}) {
  const { path = "webhooks/deliveries", page, perPage, status } = options;

  return kiwifyFetch<unknown>(path, {
    searchParams: {
      page,
      per_page: perPage,
      status,
    },
  });
}
