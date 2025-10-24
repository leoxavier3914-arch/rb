import { kiwifyFetch } from "@/lib/kiwify/client";

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
  page?: number;
  perPage?: number;
  status?: string;
  createdAfter?: string;
  path?: string;
} = {}) {
  const { path = "sales", page, perPage, status, createdAfter } = options;

  return kiwifyFetch<unknown>(path, {
    searchParams: {
      page,
      per_page: perPage,
      status,
      created_after: createdAfter,
    },
  });
}

export async function fetchFinancialSummary(options: { path?: string } = {}) {
  const { path = "financial/summary" } = options;
  return kiwifyFetch<unknown>(path, { cache: "no-store" });
}

export async function listWithdrawals(options: {
  page?: number;
  perPage?: number;
  path?: string;
} = {}) {
  const { path = "financial/withdrawals", page, perPage } = options;

  return kiwifyFetch<unknown>(path, {
    searchParams: {
      page,
      per_page: perPage,
    },
  });
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
