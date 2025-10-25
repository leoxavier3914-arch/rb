import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const activeOrderSchema = z.object({
  customer_id: z.number(),
});

const customerRowSchema = z.object({
  id: z.number(),
  external_id: z.string().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  country: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const customerIdSchema = z.object({ id: z.number() });

const orderMetricSchema = z.object({
  customer_id: z.number(),
  status: z.string(),
  net_cents: z.number().nullable(),
  approved_at: z.string().nullable(),
});

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
  search: z.string().optional(),
  active: z.string().optional(),
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

  let filterIds: number[] | undefined;
  if (params.active === "true") {
    const { data, error } = await supabaseAdmin
      .from("kfy_orders")
      .select("customer_id")
      .eq("status", "approved")
      .is("refunded_at", null)
      .limit(1000);
    if (error) {
      throw new Error(`Erro ao buscar clientes ativos: ${error.message}`);
    }
    const rows = z.array(activeOrderSchema).parse(data ?? []);
    filterIds = Array.from(new Set(rows.map((row) => row.customer_id)));
    if (filterIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }
  }

  if (params.search) {
    const sanitized = params.search.replace(/[%_]/g, "");
    const pattern = `%${sanitized}%`;
    const { data, error } = await supabaseAdmin
      .from("kfy_customers")
      .select("id")
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(200);
    if (error) {
      throw new Error(`Erro ao filtrar clientes: ${error.message}`);
    }
    const searchRows = z.array(customerIdSchema).parse(data ?? []);
    const searchIds = searchRows.map((row) => row.id);
    filterIds = filterIds ? filterIds.filter((id) => searchIds.includes(id)) : searchIds;
    if (!filterIds?.length) {
      return NextResponse.json({ items: [], nextCursor: null });
    }
  }

  let query = supabaseAdmin
    .from("kfy_customers")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(params.limit + 1);

  if (filterIds?.length) {
    query = query.in("id", filterIds);
  }
  if (cursor) {
    query = query.or(
      `and(created_at.lt.${cursor.createdAt}),and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao consultar clientes: ${error.message}`);
  }
  const customerRows = z.array(customerRowSchema).parse(data ?? []);

  const hasNextPage = customerRows.length > params.limit;
  const rows = hasNextPage ? customerRows.slice(0, -1) : customerRows;
  const ids = rows.map((row) => row.id);

  const metricMap = new Map<
    number,
    { orders: number; totalNetCents: number; lastPurchase: string | null }
  >();

  if (ids.length) {
    const { data: orderMetrics, error: metricsError } = await supabaseAdmin
      .from("kfy_orders")
      .select("customer_id,status,net_cents,approved_at")
      .in("customer_id", ids);

    if (metricsError) {
      throw new Error(`Erro ao agregar pedidos de clientes: ${metricsError.message}`);
    }

    for (const row of z.array(orderMetricSchema).parse(orderMetrics ?? [])) {
      const entry = metricMap.get(row.customer_id) ?? {
        orders: 0,
        totalNetCents: 0,
        lastPurchase: null as string | null,
      };

      entry.orders += 1;

      if (row.status === "approved") {
        entry.totalNetCents += Number(row.net_cents ?? 0);
        if (row.approved_at) {
          if (!entry.lastPurchase || row.approved_at > entry.lastPurchase) {
            entry.lastPurchase = row.approved_at;
          }
        }
      }

      metricMap.set(row.customer_id, entry);
    }
  }

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      externalId: row.external_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      country: row.country,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metrics: metricMap.get(row.id) ?? {
        orders: 0,
        totalNetCents: 0,
        lastPurchase: null,
      },
    })),
    nextCursor: hasNextPage && rows.length ? encodeCursor(rows[rows.length - 1]) : null,
  });
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
