import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const [createdAt, id] = cursor.split("::");
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

function encodeCursor(row: { created_at: string; id: number }) {
  return `${row.created_at}::${row.id}`;
}

export async function GET(request: NextRequest) {
  assertIsAdmin(request);
  const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const cursor = decodeCursor(params.cursor);

  let query = supabaseAdmin
    .from("kfy_refunds")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(params.limit + 1);

  if (params.status) {
    query = query.in("status", params.status.split(","));
  }
  if (params.from) {
    query = query.gte("created_at", new Date(params.from).toISOString());
  }
  if (params.to) {
    const inclusive = new Date(`${params.to}T23:59:59-03:00`).toISOString();
    query = query.lte("created_at", inclusive);
  }
  if (params.search) {
    const sanitized = params.search.replace(/[%_]/g, "");
    query = query.or(
      `reason.ilike.%${sanitized}%,external_id.ilike.%${sanitized}%`,
    );
  }
  if (cursor) {
    query = query.or(
      `and(created_at.lt.${cursor.createdAt}),and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data: refunds, error } = await query;
  if (error) {
    throw new Error(`Erro ao consultar reembolsos: ${error.message}`);
  }
  const refundRows = refunds ?? [];

  const hasNextPage = refundRows.length > params.limit;
  const rows = hasNextPage ? refundRows.slice(0, -1) : refundRows;

  const orderIds = Array.from(new Set(rows.map((row) => row.order_id)));
  let orders: { id: number; external_id: string; product_id: number; customer_id: number }[] = [];
  if (orderIds.length) {
    const { data, error: orderError } = await supabaseAdmin
      .from("kfy_orders")
      .select("id, external_id, product_id, customer_id")
      .in("id", orderIds);
    if (orderError) {
      throw new Error(`Erro ao consultar pedidos para reembolsos: ${orderError.message}`);
    }
    orders = data ?? [];
  }

  const productIds = Array.from(new Set(orders.map((order) => order.product_id)));
  const customerIds = Array.from(new Set(orders.map((order) => order.customer_id)));

  const [{ data: products }, { data: customers }] = await Promise.all([
    productIds.length
      ? supabaseAdmin.from("kfy_products").select("id, title").in("id", productIds)
      : { data: [], error: null },
    customerIds.length
      ? supabaseAdmin.from("kfy_customers").select("id, name, email").in("id", customerIds)
      : { data: [], error: null },
  ]);

  const productMap = new Map(products?.map((product) => [product.id, product]) ?? []);
  const customerMap = new Map(customers?.map((customer) => [customer.id, customer]) ?? []);
  const orderMap = new Map(orders?.map((order) => [order.id, order]) ?? []);

  return NextResponse.json({
    items: rows.map((row) => {
      const order = orderMap.get(row.order_id);
      const product = order ? productMap.get(order.product_id) : null;
      const customer = order ? customerMap.get(order.customer_id) : null;
      return {
        id: row.id,
        externalId: row.external_id,
        status: row.status,
        amountCents: row.amount_cents,
        createdAt: row.created_at,
        processedAt: row.processed_at,
        reason: row.reason,
        order: order
          ? {
              id: order.id,
              externalId: order.external_id,
            }
          : null,
        product,
        customer,
      };
    }),
    nextCursor: hasNextPage && rows.length ? encodeCursor(rows[rows.length - 1]) : null,
  });
}
