import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

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
    filterIds = Array.from(new Set((data ?? []).map((row) => row.customer_id)));
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
    const searchIds = data?.map((row) => row.id) ?? [];
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
  const customerRows = data ?? [];

  const hasNextPage = customerRows.length > params.limit;
  const rows = hasNextPage ? customerRows.slice(0, -1) : customerRows;
  const ids = rows.map((row) => row.id);

  let metrics: any[] = [];
  if (ids.length) {
    const { data: metricsData } = await supabaseAdmin
      .from("kfy_orders")
      .select(
        "customer_id, count(*) as orders_count, sum(case when status = 'approved' then net_cents end) as total_net, max(approved_at) as last_purchase",
      )
      .in("customer_id", ids)
      .group("customer_id");
    metrics = metricsData ?? [];
  }

  const metricMap = new Map(metrics.map((metric) => [metric.customer_id, metric]));

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
      metrics: {
        orders: Number(metricMap.get(row.id)?.orders_count ?? 0),
        totalNetCents: Number(metricMap.get(row.id)?.total_net ?? 0),
        lastPurchase: metricMap.get(row.id)?.last_purchase ?? null,
      },
    })),
    nextCursor: hasNextPage && rows.length ? encodeCursor(rows[rows.length - 1]) : null,
  });
}
