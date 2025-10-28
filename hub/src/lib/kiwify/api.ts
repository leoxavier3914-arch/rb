import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/service";
import type { SalesInsert } from "@/types/database";

const DEFAULT_API_BASE_URL = "https://public-api.kiwify.com/v1";

const saleSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    status: z.string().optional().nullable(),
    total_amount_cents: z.union([z.number(), z.string()]).optional().nullable(),
    total_amount: z.union([z.number(), z.string()]).optional().nullable(),
    amount: z.union([z.number(), z.string()]).optional().nullable(),
    net_amount_cents: z.union([z.number(), z.string()]).optional().nullable(),
    net_amount: z.union([z.number(), z.string()]).optional().nullable(),
    fee_amount_cents: z.union([z.number(), z.string()]).optional().nullable(),
    fee_amount: z.union([z.number(), z.string()]).optional().nullable(),
    currency: z.string().optional().nullable(),
    created_at: z.string().optional().nullable(),
    inserted_at: z.string().optional().nullable(),
    paid_at: z.string().optional().nullable(),
    approved_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
    customer: z
      .object({
        name: z.string().optional().nullable(),
        full_name: z.string().optional().nullable(),
        email: z.string().optional().nullable()
      })
      .optional()
      .nullable(),
    customer_name: z.string().optional().nullable(),
    product: z
      .object({
        name: z.string().optional().nullable(),
        title: z.string().optional().nullable()
      })
      .optional()
      .nullable(),
    product_name: z.string().optional().nullable(),
    product_title: z.string().optional().nullable()
  })
  .passthrough();

const salesListSchema = z
  .object({
    data: z.array(saleSchema).optional(),
    items: z.array(saleSchema).optional(),
    page: z.number().optional(),
    page_number: z.number().optional(),
    page_size: z.number().optional(),
    per_page: z.number().optional(),
    total: z.number().optional(),
    total_items: z.number().optional(),
    total_pages: z.number().optional()
  })
  .passthrough();

interface FetchSalesPageParams {
  readonly token: string;
  readonly page: number;
  readonly pageSize: number;
  readonly baseUrl: string;
  readonly accountId?: string | null;
}

interface FetchSalesPageResult {
  readonly items: readonly SalesInsert[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number | null;
  readonly totalPages: number | null;
}

function normalizeBaseUrl(raw?: string | null): string {
  if (!raw) {
    return DEFAULT_API_BASE_URL;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  if (/\/v\d+$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed.replace(/\/+$/, "")}/v1`;
}

function resolveTokenUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  if (/\/oauth\/token$/i.test(normalized)) {
    return normalized;
  }
  if (/\/v\d+$/i.test(normalized)) {
    return `${normalized.replace(/\/v\d+$/i, "")}/oauth/token`;
  }
  return `${normalized}/oauth/token`;
}

function buildApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}${normalizedPath}`;
}

function parseAmountCents(candidate: unknown): number | null {
  if (candidate === null || candidate === undefined) {
    return null;
  }
  if (typeof candidate === "number") {
    if (!Number.isFinite(candidate)) {
      return null;
    }
    if (Number.isInteger(candidate)) {
      return candidate;
    }
    return Math.round(candidate * 100);
  }
  if (typeof candidate === "string") {
    const normalized = candidate.replace(/,/g, ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    if (Number.isInteger(parsed)) {
      return parsed;
    }
    return Math.round(parsed * 100);
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function mapSaleToInsert(sale: z.infer<typeof saleSchema>): SalesInsert {
  const total =
    parseAmountCents(sale.total_amount_cents) ??
    parseAmountCents(sale.total_amount) ??
    parseAmountCents(sale.amount) ??
    0;
  const net =
    parseAmountCents(sale.net_amount_cents) ??
    parseAmountCents(sale.net_amount) ??
    total;
  const fee =
    parseAmountCents(sale.fee_amount_cents) ??
    parseAmountCents(sale.fee_amount) ??
    Math.max(total - net, 0);

  const customerName =
    sale.customer?.name ??
    sale.customer?.full_name ??
    sale.customer_name ??
    null;

  const productName =
    sale.product?.name ??
    sale.product?.title ??
    sale.product_name ??
    sale.product_title ??
    null;

  return {
    id: String(sale.id),
    status: sale.status ?? null,
    product_name: productName,
    customer_name: customerName,
    customer_email: sale.customer?.email ?? null,
    total_amount_cents: total,
    net_amount_cents: net,
    fee_amount_cents: fee,
    currency: sale.currency ?? "BRL",
    created_at: normalizeDate(sale.created_at ?? sale.inserted_at ?? null),
    paid_at: normalizeDate(sale.paid_at ?? sale.approved_at ?? null),
    updated_at: normalizeDate(sale.updated_at ?? null),
    raw: sale
  };
}

async function fetchAccessToken(baseUrl: string): Promise<string> {
  const env = getEnv();
  const clientId = env.KIWIFY_CLIENT_ID;
  const clientSecret = env.KIWIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais da Kiwify não configuradas.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(resolveTokenUrl(baseUrl), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token da Kiwify: ${response.status}`);
  }

  const payload = await response.json();
  const token = z.object({ access_token: z.string() }).parse(payload).access_token;
  return token;
}

async function fetchSalesPage({ token, page, pageSize, baseUrl, accountId }: FetchSalesPageParams): Promise<FetchSalesPageResult> {
  const url = new URL(buildApiUrl(baseUrl, "/sales"));
  url.searchParams.set("page_number", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      ...(accountId ? { "x-kiwify-account-id": accountId } : {})
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Falha ao listar vendas na Kiwify (${response.status}): ${body.slice(0, 200)}`);
  }

  const payload = await response.json();
  const parsed = salesListSchema.parse(payload);
  const items = (parsed.data ?? parsed.items ?? []).map(mapSaleToInsert);
  const totalItems = parsed.total_items ?? parsed.total ?? null;
  const totalPages = parsed.total_pages ?? (totalItems && parsed.page_size ? Math.ceil(totalItems / parsed.page_size) : null);
  const currentPage = parsed.page_number ?? parsed.page ?? page;
  const currentPageSize = parsed.page_size ?? parsed.per_page ?? pageSize;

  return {
    items,
    page: currentPage,
    pageSize: currentPageSize,
    totalItems,
    totalPages
  };
}

export interface SyncSalesResult {
  readonly imported: number;
  readonly total: number;
}

export async function syncSalesFromKiwify(): Promise<SyncSalesResult> {
  const env = getEnv();
  const baseUrl = normalizeBaseUrl(env.KIWIFY_API_BASE_URL);
  const supabase = getServiceClient();
  const token = await fetchAccessToken(baseUrl);
  const pageSize = 100;

  let page = 1;
  let imported = 0;
  let totalItems: number | null = null;

  while (true) {
    const result = await fetchSalesPage({
      token,
      page,
      pageSize,
      baseUrl,
      accountId: env.KIWIFY_ACCOUNT_ID
    });

    if (result.items.length === 0) {
      break;
    }

    const { error } = await supabase.from("sales").upsert(result.items, { onConflict: "id" });
    if (error) {
      throw new Error(`Falha ao salvar vendas no Supabase: ${error.message}`);
    }

    imported += result.items.length;
    totalItems = totalItems ?? result.totalItems ?? null;

    const reachedEnd =
      (result.totalPages !== null && result.page >= result.totalPages) ||
      (result.totalPages === null && result.items.length < result.pageSize);

    if (reachedEnd) {
      break;
    }

    page += 1;
  }

  return {
    imported,
    total: totalItems ?? imported
  };
}
