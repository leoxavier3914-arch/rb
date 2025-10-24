import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const enrollmentRowSchema = z.object({
  id: z.number(),
  external_id: z.string(),
  product_id: z.number().nullable(),
  customer_id: z.number().nullable(),
  status: z.string(),
  started_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
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
  customerId: z.string().optional(),
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
    .from("kfy_enrollments")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(params.limit + 1);

  if (params.status) {
    query = query.in("status", params.status.split(","));
  }
  if (params.customerId) {
    const ids = params.customerId
      .split(",")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));
    if (ids.length) {
      query = query.in("customer_id", ids);
    }
  }
  if (cursor) {
    query = query.or(
      `and(created_at.lt.${cursor.createdAt}),and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao consultar matrículas: ${error.message}`);
  }
  const enrollmentRows = z.array(enrollmentRowSchema).parse(data ?? []);

  const hasNextPage = enrollmentRows.length > params.limit;
  const rows = hasNextPage ? enrollmentRows.slice(0, -1) : enrollmentRows;

  const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id)));

  const [{ data: products }, { data: customers }] = await Promise.all([
    productIds.length
      ? supabaseAdmin.from("kfy_products").select("id, title").in("id", productIds)
      : { data: [], error: null },
    customerIds.length
      ? supabaseAdmin.from("kfy_customers").select("id, name, email").in("id", customerIds)
      : { data: [], error: null },
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
      startedAt: row.started_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      product: row.product_id ? productMap.get(row.product_id) ?? null : null,
      customer: row.customer_id ? customerMap.get(row.customer_id) ?? null : null,
    })),
    nextCursor: hasNextPage && rows.length ? encodeCursor(rows[rows.length - 1]) : null,
  });
}
