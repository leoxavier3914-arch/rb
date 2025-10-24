import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const querySchema = z.object({
  from: z.string(),
  to: z.string(),
  status: z.string().optional(),
  productId: z.string().optional(),
  paymentMethod: z.string().optional(),
});

type OrderRow = {
  product_id: number;
  payment_method: string;
  status: string;
  gross_cents: number;
  net_cents: number;
  commission_cents: number;
  fee_cents: number;
  approved_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  assertIsAdmin(request);
  const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  let query = supabaseAdmin
    .from("kfy_orders")
    .select("product_id, payment_method, status, gross_cents, net_cents, commission_cents, fee_cents, approved_at, created_at")
    .gte("created_at", new Date(params.from).toISOString())
    .lte("created_at", new Date(`${params.to}T23:59:59-03:00`).toISOString());

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

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao buscar dados do dashboard: ${error.message}`);
  }
  const rows = (data ?? []) as OrderRow[];

  const approved = rows.filter((row) => row.status === "approved");

  const kpi = approved.reduce(
    (accumulator, order) => {
      accumulator.grossCents += order.gross_cents ?? 0;
      accumulator.netCents += order.net_cents ?? 0;
      accumulator.feeCents += order.fee_cents ?? 0;
      accumulator.commissionCents += order.commission_cents ?? 0;
      return accumulator;
    },
    { grossCents: 0, netCents: 0, feeCents: 0, commissionCents: 0 },
  );

  const statusCounts = rows.reduce(
    (accumulator, order) => {
      const key = order.status as keyof typeof accumulator;
      if (key in accumulator) {
        accumulator[key] += 1;
      }
      return accumulator;
    },
    { approved: 0, pending: 0, refunded: 0, rejected: 0 },
  );

  const revenueSeriesMap = new Map<string, { grossCents: number; netCents: number }>();
  approved.forEach((order) => {
    const key = format(new Date(order.approved_at ?? order.created_at), "yyyy-MM-dd");
    const current = revenueSeriesMap.get(key) ?? { grossCents: 0, netCents: 0 };
    current.grossCents += order.gross_cents ?? 0;
    current.netCents += order.net_cents ?? 0;
    revenueSeriesMap.set(key, current);
  });

  const productMap = new Map<number, { grossCents: number }>();
  approved.forEach((order) => {
    const current = productMap.get(order.product_id) ?? { grossCents: 0 };
    current.grossCents += order.gross_cents ?? 0;
    productMap.set(order.product_id, current);
  });

  const paymentMethodMap = new Map<string, { grossCents: number }>();
  approved.forEach((order) => {
    const method = order.payment_method ?? "indefinido";
    const current = paymentMethodMap.get(method) ?? { grossCents: 0 };
    current.grossCents += order.gross_cents ?? 0;
    paymentMethodMap.set(method, current);
  });

  const productIds = Array.from(productMap.keys());
  const { data: products } = productIds.length
    ? await supabaseAdmin.from("kfy_products").select("id, title").in("id", productIds)
    : { data: [] };
  const productTitleMap = new Map(products?.map((product) => [product.id, product.title]) ?? []);

  return NextResponse.json({
    kpi,
    statusCounts,
    revenueSeries: Array.from(revenueSeriesMap.entries()).map(([date, value]) => ({ date, ...value })),
    productSeries: Array.from(productMap.entries()).map(([productId, value]) => ({
      product: productTitleMap.get(productId) ?? `Produto #${productId}`,
      grossCents: value.grossCents,
    })),
    methodSeries: Array.from(paymentMethodMap.entries()).map(([method, value]) => ({
      method,
      grossCents: value.grossCents,
    })),
  });
}
