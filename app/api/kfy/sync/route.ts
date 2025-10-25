import { addDays, formatISO, isAfter, parseISO } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import {
  extractCollection,
  fetchAllSalesByWindow,
  buildRequestLogUrl,
  listProducts,
  requestWithBackoff,
  shouldRequestNextPage,
} from "@/lib/kiwify/resources";
import { normalizeProduct, normalizeSale, type NormalizedSaleRecord } from "@/lib/kiwify/normalizers";
import { supabaseAdmin } from "@/lib/supabase";
import type { KfyCustomer, KfyOrder, KfyProduct } from "@/types/kfy";

const querySchema = z.object({
  full: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const MAX_CHUNK = 500;
const PRODUCT_PAGE_SIZE = 100;

type SyncWindow = {
  full: boolean;
  from?: string;
  to?: string;
};

const externalIdRowSchema = z.object({
  id: z.number(),
  external_id: z.string(),
});

async function chunkedUpsert<T>(table: string, rows: T[]) {
  for (let index = 0; index < rows.length; index += MAX_CHUNK) {
    const chunk = rows.slice(index, index + MAX_CHUNK);
    const { error } = await (supabaseAdmin.from(table as any) as any).upsert(chunk as any[], {
      onConflict: "external_id",
    });
    if (error) {
      throw new Error(`Erro ao gravar ${table}: ${error.message}`);
    }
  }
}

async function chunkedInsert<T>(table: string, rows: T[]) {
  for (let index = 0; index < rows.length; index += MAX_CHUNK) {
    const chunk = rows.slice(index, index + MAX_CHUNK);
    const { error } = await (supabaseAdmin.from(table as any) as any).upsert(chunk as any[], {
      onConflict: "type,external_id",
    });
    if (error) {
      throw new Error(`Erro ao registrar eventos ${table}: ${error.message}`);
    }
  }
}

async function buildIdMap(table: string, externalIds: string[]) {
  if (!externalIds.length) return new Map<string, number>();
  const uniqueIds = Array.from(new Set(externalIds));
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, external_id")
    .in("external_id", uniqueIds);
  if (error) {
    throw new Error(`Erro ao consultar ${table}: ${error.message}`);
  }
  const parsed = z.array(externalIdRowSchema).parse(data ?? []);
  return new Map(parsed.map((row) => [row.external_id, row.id]));
}

function mapProducts(products: KfyProduct[]) {
  return products.map((product) => ({
    external_id: product.externalId,
    title: product.title,
    description: product.description,
    image_url: product.imageUrl,
    price_cents: product.priceCents,
    currency: product.currency,
    status: product.status,
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
    raw: product.raw ?? {},
  }));
}

function mapCustomers(customers: KfyCustomer[]) {
  return customers.map((customer) => ({
    external_id: customer.externalId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    country: customer.country,
    created_at: customer.createdAt.toISOString(),
    updated_at: customer.updatedAt.toISOString(),
    raw: customer.raw ?? {},
  }));
}

async function mapOrders(orders: KfyOrder[]) {
  const productIds = await buildIdMap(
    "kfy_products",
    orders.map((order) => order.productExternalId),
  );
  const customerIds = await buildIdMap(
    "kfy_customers",
    orders.map((order) => order.customerExternalId),
  );

  return orders
    .map((order) => {
      const productId = productIds.get(order.productExternalId);
      const customerId = customerIds.get(order.customerExternalId);
      if (!productId || !customerId) return null;
      return {
        external_id: order.externalId,
        product_id: productId,
        customer_id: customerId,
        status: order.status,
        payment_method: order.paymentMethod,
        gross_cents: order.grossCents,
        fee_cents: order.feeCents,
        net_cents: order.netCents,
        commission_cents: order.commissionCents,
        currency: order.currency,
        approved_at: order.approvedAt?.toISOString() ?? null,
        refunded_at: order.refundedAt?.toISOString() ?? null,
        canceled_at: order.canceledAt?.toISOString() ?? null,
        created_at: order.createdAt.toISOString(),
        updated_at: order.updatedAt.toISOString(),
        raw: order.raw ?? {},
      };
    })
    .filter(Boolean);
}

function buildEventPayload(type: string, payload: Record<string, unknown>[]) {
  return payload.map((row) => ({
    type,
    external_id: String(row.external_id),
    payload: row,
    occurred_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  }));
}

function resolveSyncRange(window: SyncWindow) {
  if (window.full) {
    const end = formatISO(new Date(), { representation: "date" });
    const start = formatISO(addDays(new Date(), -90), { representation: "date" });
    return { start, end };
  }

  if (!window.from) {
    throw new Error("Parâmetro 'from' é obrigatório para sincronização incremental");
  }

  const from = parseISO(window.from);
  if (Number.isNaN(from.getTime())) {
    throw new Error("Parâmetro 'from' inválido: use o formato yyyy-mm-dd");
  }

  const to = window.to ? parseISO(window.to) : from;
  if (Number.isNaN(to.getTime())) {
    throw new Error("Parâmetro 'to' inválido: use o formato yyyy-mm-dd");
  }

  if (isAfter(from, to)) {
    throw new Error("O parâmetro 'from' deve ser anterior ou igual a 'to'");
  }

  return {
    start: formatISO(from, { representation: "date" }),
    end: formatISO(to, { representation: "date" }),
  };
}

async function fetchAllProducts(pageSize = PRODUCT_PAGE_SIZE) {
  const productMap = new Map<string, KfyProduct>();
  let page = 1;
  const resourcePath = "products";

  while (true) {
    const searchParams = {
      page_number: page,
      page_size: pageSize,
    } as const;

    const response = await requestWithBackoff(
      () => listProducts({ pageNumber: page, pageSize }),
      {
        method: "GET",
        url: buildRequestLogUrl(resourcePath, searchParams),
        range: null,
        page,
        cursor: { resource: "products" },
      },
    );
    const records = extractCollection(response);

    for (const record of records) {
      try {
        const product = normalizeProduct(record);
        if (product.externalId) {
          productMap.set(product.externalId, product);
        }
      } catch (error) {
        console.warn("[kfy-sync] Produto inválido ignorado", error);
      }
    }

    if (!shouldRequestNextPage(response, records.length, pageSize, page)) {
      break;
    }

    page += 1;
  }

  return Array.from(productMap.values());
}

async function collectSales(start: string, end: string) {
  const result = await fetchAllSalesByWindow(start, end);
  const sales: NormalizedSaleRecord[] = [];

  for (const raw of result.sales) {
    try {
      const normalized = normalizeSale(raw);
      if (normalized) {
        sales.push(normalized);
      }
    } catch (error) {
      console.warn("[kfy-sync] Venda inválida ignorada", error);
    }
  }

  return { sales, summary: result.summary };
}

async function ensureAdminResponse(request: NextRequest) {
  try {
    await assertIsAdmin(request);
    return null;
  } catch (error) {
    if (error instanceof Response) {
      const text = await error.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(text || "{}") as Record<string, unknown>;
      } catch {
        payload = { error: text || "not_authorized" };
      }
      const body = JSON.stringify({ ok: false, ...payload });
      return new NextResponse(body, {
        status: error.status,
        headers: { "content-type": "application/json" },
      });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const adminError = await ensureAdminResponse(request);
  if (adminError) {
    return adminError;
  }

  try {
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const window: SyncWindow = {
      full: query.full === "true" || (!query.from && !query.to),
      from: query.from ?? undefined,
      to: query.to ?? undefined,
    };

    const range = resolveSyncRange(window);

    const [apiProducts, { sales, summary: salesSummary }] = await Promise.all([
      fetchAllProducts(),
      collectSales(range.start, range.end),
    ]);

    const productMap = new Map<string, KfyProduct>();
    apiProducts.forEach((product) => productMap.set(product.externalId, product));

    const customerMap = new Map<string, KfyCustomer>();
    const orderMap = new Map<string, KfyOrder>();

    sales.forEach((sale) => {
      if (sale.product?.externalId) {
        productMap.set(sale.product.externalId, sale.product);
      }
      customerMap.set(sale.customer.externalId, sale.customer);
      orderMap.set(sale.order.externalId, sale.order);
    });

    const products = Array.from(productMap.values());
    const customers = Array.from(customerMap.values());
    const orders = Array.from(orderMap.values());

    const productRows = products.length ? mapProducts(products) : [];
    const customerRows = customers.length ? mapCustomers(customers) : [];
    const mappedOrders = orders.length ? await mapOrders(orders) : [];

    if (productRows.length) {
      await chunkedUpsert("kfy_products", productRows);
    }
    if (customerRows.length) {
      await chunkedUpsert("kfy_customers", customerRows);
    }
    if (mappedOrders.length) {
      await chunkedUpsert("kfy_orders", mappedOrders);
    }

    const events = [
      ...buildEventPayload("product", productRows),
      ...buildEventPayload("customer", customerRows),
      ...buildEventPayload("order", mappedOrders as Record<string, unknown>[]),
    ];

    if (events.length) {
      await chunkedInsert("kfy_events", events);
    }

    return NextResponse.json({
      ok: true,
      summary: {
        range,
        products: products.length,
        customers: customers.length,
        orders: orders.length,
        sales: sales.length,
        salesWindows: salesSummary.totalIntervals,
        salesPages: salesSummary.totalPages,
      },
    });
  } catch (error) {
    console.error("[kfy-sync] Falha ao executar sincronização", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", error: message },
      { status: 500 },
    );
  }
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
