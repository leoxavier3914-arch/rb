import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const customerIdSchema = z.object({ id: z.number() });

const orderRowSchema = z.object({
  id: z.number(),
  external_id: z.string(),
  status: z.string(),
  payment_method: z.string().nullable(),
  gross_cents: z.number().nullable(),
  fee_cents: z.number().nullable(),
  net_cents: z.number().nullable(),
  commission_cents: z.number().nullable(),
  currency: z.string().nullable(),
  created_at: z.string(),
  approved_at: z.string().nullable(),
  product_id: z.number().nullable(),
  customer_id: z.number().nullable(),
});

const productSummarySchema = z.object({
  id: z.number(),
  title: z.string().nullable(),
});

const customerSummarySchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  email: z.string().nullable(),
});

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  productId: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
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

  let customerFilter: number[] | undefined;
  if (params.search) {
    const sanitized = params.search.replace(/[%_]/g, "");
    const pattern = `%${sanitized}%`;
    const { data: matchingCustomers, error: customerError } = await supabaseAdmin
      .from("kfy_customers")
      .select("id")
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(200);
    if (customerError) {
      throw new Error(`Erro ao buscar clientes: ${customerError.message}`);
    }
    const parsedCustomers = z.array(customerIdSchema).parse(matchingCustomers ?? []);
    customerFilter = parsedCustomers.map((customer) => customer.id);
    if (customerFilter.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }
  }

  let query = supabaseAdmin
    .from("kfy_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(params.limit + 1);

  if (params.status) {
    query = query.in("status", params.status.split(","));
  }
  if (params.paymentMethod) {
    query = query.in("payment_method", params.paymentMethod.split(","));
  }
  if (params.productId) {
    const ids = params.productId
      .split(",")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));
    if (ids.length) {
      query = query.in("product_id", ids);
    }
  }
  if (params.from) {
    query = query.gte("created_at", new Date(params.from).toISOString());
  }
  if (params.to) {
    const inclusive = new Date(`${params.to}T23:59:59-03:00`).toISOString();
    query = query.lte("created_at", inclusive);
  }
  if (customerFilter?.length) {
    query = query.in("customer_id", customerFilter);
  }
  if (cursor) {
    query = query.or(
      `and(created_at.lt.${cursor.createdAt}),and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data: orders, error } = await query;
  if (error) {
    throw new Error(`Erro ao consultar vendas: ${error.message}`);
  }
  const orderRows = z.array(orderRowSchema).parse(orders ?? []);

  const hasNextPage = orderRows.length > params.limit;
  const rows = hasNextPage ? orderRows.slice(0, -1) : orderRows;

  const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id)));

  const [{ data: products }, { data: customers }] = await Promise.all([
    supabaseAdmin.from("kfy_products").select("id, title").in("id", productIds),
    supabaseAdmin.from("kfy_customers").select("id, name, email").in("id", customerIds),
  ]);

  const productMap = new Map(
    z
      .array(productSummarySchema)
      .parse(products ?? [])
      .map((product) => [product.id, product] as const),
  );
  const customerMap = new Map(
    z
      .array(customerSummarySchema)
      .parse(customers ?? [])
      .map((customer) => [customer.id, customer] as const),
  );

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      externalId: row.external_id,
      status: row.status,
      paymentMethod: row.payment_method,
      grossCents: row.gross_cents,
      feeCents: row.fee_cents,
      netCents: row.net_cents,
      commissionCents: row.commission_cents,
      currency: row.currency,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      customer: row.customer_id ? customerMap.get(row.customer_id) ?? null : null,
      product: row.product_id ? productMap.get(row.product_id) ?? null : null,
    })),
    nextCursor: hasNextPage && rows.length ? encodeCursor(rows[rows.length - 1]) : null,
  });
}
