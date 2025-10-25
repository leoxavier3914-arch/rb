import { addDays, formatISO, isAfter, parseISO } from "date-fns";

import { KiwifyApiError, formatKiwifyApiPath } from "@/lib/kiwify/client";
import { kiwifyFetch } from "@/lib/kiwify/http";
import { buildSalesWindow } from "@/lib/kiwify/dateWindow";

const MAX_SALES_RANGE_DAYS = 90;

const MAX_SALES_PAGE_SIZE = 100;

const PAGE_REQUEST_CONCURRENCY = 3;
const MAX_REQUEST_RETRIES = 4;
const BACKOFF_BASE_DELAY_MS = 500;
const MAX_BACKOFF_DELAY_MS = 10_000;

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

type KiwifyRequestOptions = {
  method?: string;
  body?: BodyInit | Record<string, unknown> | null;
  searchParams?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
};

const buildPathWithQuery = (
  resourcePath: string,
  searchParams?: Record<string, string | number | boolean | null | undefined>,
) => {
  const normalizedPath = formatKiwifyApiPath(resourcePath);
  if (!searchParams) {
    return normalizedPath;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === null || value === undefined) {
      continue;
    }
    params.set(key, typeof value === "boolean" ? String(value) : String(value));
  }

  const query = params.toString();
  return query ? `${normalizedPath}?${query}` : normalizedPath;
};

const buildAbsoluteUrl = (path: string) => {
  try {
    const base = process.env.KIWIFY_API_BASE_URL;
    if (!base) {
      return path;
    }
    return new URL(path, base).toString();
  } catch {
    return path;
  }
};

const resolveRequestBody = (body: KiwifyRequestOptions["body"], headers: Headers) => {
  if (body === null || body === undefined) {
    return undefined;
  }

  if (typeof body === "string") {
    return body;
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return body;
  }

  if (ArrayBuffer.isView(body)) {
    return body as BodyInit;
  }

  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body;
  }

  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) {
    return body as BodyInit;
  }

  headers.set("content-type", "application/json");
  return JSON.stringify(body);
};

const shouldParseJson = (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
};

const parseSuccessfulBody = async <T>(response: Response): Promise<T | undefined> => {
  if (response.status === 204) {
    return undefined;
  }

  if (shouldParseJson(response)) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  return text === "" ? (undefined as T) : ((text as unknown) as T);
};

const parseErrorBody = async (response: Response) => {
  try {
    if (shouldParseJson(response)) {
      return await response.json();
    }
    const text = await response.text();
    return text ? { message: text } : null;
  } catch (error) {
    console.warn("Não foi possível interpretar a resposta da Kiwify", error);
    return null;
  }
};

async function fetchKiwifyJson<T>(resourcePath: string, options: KiwifyRequestOptions = {}) {
  const { method = "GET", body, searchParams, signal } = options;
  const path = buildPathWithQuery(resourcePath, searchParams);
  const headers = new Headers();
  const resolvedBody = resolveRequestBody(body ?? undefined, headers);

  const response = await kiwifyFetch(path, {
    method,
    body: resolvedBody,
    headers,
    signal,
  });

  if (!response.ok) {
    const details = await parseErrorBody(response);
    const url = buildAbsoluteUrl(path);
    console.error("Kiwify API request failed", {
      method,
      url,
      status: response.status,
      details: typeof details === "string" ? details : JSON.stringify(details ?? {}),
    });
    throw new KiwifyApiError("Falha ao consultar a API da Kiwify.", response.status, { method, url }, details);
  }

  return (await parseSuccessfulBody<T>(response)) as T;
}

type StructuredLogLevel = "info" | "warn" | "error";

export type RequestLogContext = {
  method: string;
  url: string;
  range?: { startDate: string; endDate: string } | null;
  page?: number;
  cursor?: Record<string, unknown> | null;
};

type AttemptLogContext = RequestLogContext & {
  status: number | null;
  elapsedMs: number;
  attempt: number;
  error?: string;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const logStructuredRequest = (level: StructuredLogLevel, context: AttemptLogContext) => {
  const payload: AttemptLogContext = {
    range: context.range ?? null,
    cursor: context.cursor ?? null,
    ...context,
  };

  // eslint-disable-next-line no-console
  console[level]("[kfy-sync] request", payload);
};

const shouldRetryStatus = (status: number | null | undefined) => {
  if (status === 429) {
    return true;
  }

  if (typeof status === "number" && status >= 500 && status < 600) {
    return true;
  }

  return false;
};

export async function requestWithBackoff<T>(
  perform: () => Promise<T>,
  context: RequestLogContext,
): Promise<T> {
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startedAt = Date.now();
    try {
      const result = await perform();
      const elapsedMs = Date.now() - startedAt;

      logStructuredRequest("info", {
        ...context,
        status: 200,
        elapsedMs,
        attempt: attempt + 1,
      });

      return result;
    } catch (error) {
      const status = error instanceof KiwifyApiError ? error.status : null;
      const elapsedMs = Date.now() - startedAt;
      const shouldRetry = shouldRetryStatus(status);

      logStructuredRequest(shouldRetry ? "warn" : "error", {
        ...context,
        status,
        elapsedMs,
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!shouldRetry || attempt >= MAX_REQUEST_RETRIES - 1) {
        throw error;
      }

      const backoffDelay = Math.min(BACKOFF_BASE_DELAY_MS * 2 ** attempt, MAX_BACKOFF_DELAY_MS);
      attempt += 1;
      await delay(backoffDelay);
    }
  }
}

export const buildRequestLogUrl = (
  path: string,
  searchParams: Record<string, string | number | undefined>,
) => {
  const normalizedPath = formatKiwifyApiPath(path);
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === null || value === undefined) {
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${normalizedPath}?${query}` : normalizedPath;
};

const createConcurrencyLimiter = (concurrency: number) => {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("Concurrency must be a positive integer");
  }

  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    activeCount = Math.max(0, activeCount - 1);

    if (queue.length === 0) {
      return;
    }

    const task = queue.shift();
    if (task) {
      task();
    }
  };

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount += 1;

        Promise.resolve()
          .then(task)
          .then(
            (value) => {
              resolve(value);
              next();
            },
            (error) => {
              reject(error);
              next();
            },
          );
      };

      if (activeCount < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };

  return enqueue;
};

type SalesSearchParamsOptions = {
  startDate: string;
  endDate?: string;
  pageNumber: number;
  pageSize: number;
  status?: string;
  productId?: string;
};

const buildSalesSearchParams = (options: SalesSearchParamsOptions) => {
  const { startDate, endDate, pageNumber, pageSize, status, productId } = options;
  const window = buildSalesWindow(startDate, endDate);

  const searchParams: Record<string, string | number | undefined> = {
    page_number: pageNumber,
    page_size: pageSize,
    status,
    start_date: window.startDate,
    end_date: window.endDate,
  };

  if (productId) {
    searchParams.product_id = productId;
  }

  return searchParams;
};

export const extractCollection = (payload: unknown): unknown[] => {
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

export const shouldRequestNextPage = (
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
  return fetchKiwifyJson<Record<string, unknown>>(path);
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

  return fetchKiwifyJson<unknown>(path, {
    searchParams: {
      page_number: pageNumber,
      page_size: pageSize,
    },
  });
}

export async function createProduct(payload: Record<string, unknown>, path = "products") {
  return fetchKiwifyJson<unknown>(path, {
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

  return fetchKiwifyJson<unknown>(resourcePath, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteProduct(productId: string, options: { path?: string } = {}) {
  const { path = "products" } = options;
  const resourcePath = `${path.replace(/\/$/, "")}/${productId}`;

  return fetchKiwifyJson<unknown>(resourcePath, {
    method: "DELETE",
  });
}

export async function listSales(options: {
  startDate: string;
  endDate?: string;
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

  const window = buildSalesWindow(startDate, endDate);

  const searchParams = buildSalesSearchParams({
    startDate: window.startDate,
    endDate: window.endDate,
    pageNumber: resolvedPageNumber,
    pageSize: resolvedPageSize,
    status,
    productId,
  });

  return fetchKiwifyJson<unknown>(path, {
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
  const inclusiveRangeEnd = endDate
    ? parseDateParam(endDate, "endDate")
    : parseDateParam(formatDateParam(today), "endDate");

  if (isAfter(rangeStart, inclusiveRangeEnd)) {
    throw new Error("startDate must be before or equal to endDate");
  }

  const exclusiveRangeEnd = addDays(inclusiveRangeEnd, 1);

  const intervals: { start: Date; endExclusive: Date }[] = [];
  let cursor = rangeStart;

  while (cursor < exclusiveRangeEnd) {
    const chunkEndExclusiveCandidate = addDays(cursor, MAX_SALES_RANGE_DAYS);
    const chunkEndExclusive = isAfter(chunkEndExclusiveCandidate, exclusiveRangeEnd)
      ? exclusiveRangeEnd
      : chunkEndExclusiveCandidate;

    intervals.push({ start: cursor, endExclusive: chunkEndExclusive });

    cursor = chunkEndExclusive;
  }

  const intervalStates = intervals.map((interval) => {
    const requestStart = formatDateParam(interval.start);
    const exclusiveEnd = interval.endExclusive;
    const requestEndExclusive = formatDateParam(exclusiveEnd);
    const inclusiveEnd = formatDateParam(addDays(exclusiveEnd, -1));

    return {
      requestStart,
      requestEndExclusive,
      inclusiveEnd,
      pages: new Map<number, unknown>(),
      records: new Map<number, unknown[]>(),
    };
  });

  const limit = createConcurrencyLimiter(PAGE_REQUEST_CONCURRENCY);

  let totalPages = 0;

  const processInterval = async (intervalIndex: number, page: number): Promise<void> => {
    const state = intervalStates[intervalIndex];

    await limit(async () => {
      const searchParams = buildSalesSearchParams({
        startDate: state.requestStart,
        endDate: state.requestEndExclusive,
        pageNumber: page,
        pageSize: perPage,
        status,
        productId,
      });

      const logUrl = buildRequestLogUrl(path ?? "sales", searchParams);
      const response = await requestWithBackoff(
        () =>
          fetchKiwifyJson<unknown>(path ?? "sales", {
            searchParams,
          }),
        {
          method: "GET",
          url: logUrl,
          range: { startDate: state.requestStart, endDate: state.inclusiveEnd },
          page,
          cursor: { intervalIndex },
        },
      );

      state.pages.set(page, response);

      const records = extractCollection(response);
      state.records.set(page, records);
      totalPages += 1;

      if (shouldRequestNextPage(response, records.length, perPage, page)) {
        await processInterval(intervalIndex, page + 1);
      }
    });
  };

  await Promise.all(intervalStates.map((_, index) => processInterval(index, 1)));

  const aggregatedSales: unknown[] = [];
  const aggregatedRequests: ListAllSalesResult["requests"] = [];

  intervalStates.forEach((state) => {
    const orderedPages = Array.from(state.pages.keys()).sort((a, b) => a - b);
    const pagesPayload = orderedPages.map((pageNumber) => state.pages.get(pageNumber)!);

    aggregatedRequests.push({
      range: { startDate: state.requestStart, endDate: state.inclusiveEnd },
      pages: pagesPayload,
    });

    orderedPages.forEach((pageNumber) => {
      const records = state.records.get(pageNumber) ?? [];
      aggregatedSales.push(...records);
    });
  });

  return {
    summary: {
      range: {
        startDate: intervals[0]
          ? formatDateParam(intervals[0].start)
          : formatDateParam(rangeStart),
        endDate: intervals.at(-1)
          ? formatDateParam(addDays(intervals.at(-1)!.endExclusive, -1))
          : formatDateParam(inclusiveRangeEnd),
      },
      totalIntervals: intervals.length,
      totalPages,
      totalSales: aggregatedSales.length,
    },
    sales: aggregatedSales,
    requests: aggregatedRequests,
  };
}

export async function fetchAllSalesByWindow(
  startDate: string,
  endDate: string,
  pageSize = MAX_SALES_PAGE_SIZE,
  options: { status?: string; productId?: string; path?: string } = {},
): Promise<ListAllSalesResult> {
  const { status, productId, path } = options;

  return listAllSales({
    startDate,
    endDate,
    perPage: pageSize,
    status,
    productId,
    path,
  });
}

export async function listAffiliates(options: {
  page?: number;
  perPage?: number;
  path?: string;
} = {}) {
  const { path = "affiliates", page, perPage } = options;

  return fetchKiwifyJson<unknown>(path, {
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

  return fetchKiwifyJson<unknown>(path, {
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

  return fetchKiwifyJson<unknown>(resourcePath, {
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

  return fetchKiwifyJson<unknown>(path, {
    searchParams: {
      page,
      per_page: perPage,
      status,
    },
  });
}
