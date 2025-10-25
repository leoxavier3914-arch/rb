import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const orderRowSchema = z.object({
  product_id: z.number(),
  payment_method: z.string().nullable(),
  status: z.string().nullable(),
  gross_cents: z.number().nullable(),
  net_cents: z.number().nullable(),
  commission_cents: z.number().nullable(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
});

type OrderRow = z.infer<typeof orderRowSchema>;

const productSummarySchema = z.object({
  id: z.number(),
  title: z.string().nullable(),
});

const querySchema = z.object({
  dimensions: z
    .string()
    .transform((value) => value.split(",").filter(Boolean))
    .optional()
    .default("day"),
  metrics: z
    .string()
    .transform((value) => value.split(",").filter(Boolean))
    .optional()
    .default("gross"),
  from: z.string().optional(),
  to: z.string().optional(),
});

const dimensionHandlers = {
  day: (row: OrderRow) => format(new Date(row.approved_at ?? row.created_at), "yyyy-MM-dd"),
  product: (row: OrderRow, context: { productMap: Map<number, string> }) =>
    context.productMap.get(row.product_id) ?? "Produto desconhecido",
  method: (row: OrderRow) => row.payment_method ?? "indefinido",
  status: (row: OrderRow) => row.status ?? "indefinido",
} as const;

type DimensionKey = keyof typeof dimensionHandlers;

const metricHandlers = {
  gross: (row: OrderRow) => Number(row.gross_cents ?? 0),
  net: (row: OrderRow) => Number(row.net_cents ?? 0),
  commission: (row: OrderRow) => Number(row.commission_cents ?? 0),
  orders: () => 1,
} as const;

type MetricKey = keyof typeof metricHandlers;

export async function GET(request: NextRequest) {
  await assertIsAdmin(request);
  const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  const dimensions = params.dimensions as DimensionKey[];
  const metrics = params.metrics as MetricKey[];

  let query = supabaseAdmin
    .from("kfy_orders")
    .select("product_id, payment_method, status, gross_cents, net_cents, commission_cents, approved_at, created_at")
    .eq("status", "approved");

  if (params.from) {
    query = query.gte("approved_at", new Date(params.from).toISOString());
  }
  if (params.to) {
    const inclusive = new Date(`${params.to}T23:59:59-03:00`).toISOString();
    query = query.lte("approved_at", inclusive);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao gerar relatório: ${error.message}`);
  }
  const rows = z.array(orderRowSchema).parse(data ?? []);

  const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
  const { data: products } = productIds.length
    ? await supabaseAdmin.from("kfy_products").select("id, title").in("id", productIds)
    : { data: [] };
  const productMap = new Map(
    z
      .array(productSummarySchema)
      .parse(products ?? [])
      .map((product) => [product.id, product.title ?? `Produto #${product.id}`] as const),
  );

  const context = { productMap };

  const result = new Map<string, Record<string, number | string>>();

  rows.forEach((row) => {
    const dimensionValues = dimensions.map((dimension) => {
      const handler = dimensionHandlers[dimension];
      return handler ? handler(row, context as any) : "n/a";
    });
    const key = dimensionValues.join(" | ");
    if (!result.has(key)) {
      const base: Record<string, number | string> = {};
      dimensions.forEach((dimension, index) => {
        base[dimension] = dimensionValues[index];
      });
      metrics.forEach((metric) => {
        base[metric] = 0;
      });
      result.set(key, base);
    }
    const entry = result.get(key)!;
    metrics.forEach((metric) => {
      const current = (entry[metric] as number) ?? 0;
      entry[metric] = current + metricHandlers[metric](row);
    });
  });

  return NextResponse.json({
    items: Array.from(result.values()),
  });
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
