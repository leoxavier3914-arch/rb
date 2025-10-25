import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import { createProduct, deleteProduct, updateProduct } from "@/lib/kiwify/resources";
import { supabaseAdmin } from "@/lib/supabase";
import { kfyStatusEnum, type KfyProduct } from "@/types/kfy";

const productRowSchema = z.object({
  id: z.number(),
  external_id: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  price_cents: z.number().nullable(),
  currency: z.string().nullable(),
  status: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const orderSummarySchema = z.object({
  product_id: z.number(),
  status: z.string(),
  gross_cents: z.number().nullable(),
});

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(30),
  cursor: z.string().optional(),
  status: kfyStatusEnum.optional(),
});

const productPayloadSchema = z.object({
  externalId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().default("BRL"),
  status: z.string().optional(),
  imageUrl: z.string().url().optional(),
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

const mutationsEnabled =
  process.env.KIWIFY_ALLOW_PRODUCT_MUTATIONS === "true" ||
  process.env.NEXT_PUBLIC_KIWIFY_ALLOW_PRODUCT_MUTATIONS === "true";

export async function GET(request: NextRequest) {
  assertIsAdmin(request);
  const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  const cursor = decodeCursor(params.cursor);

  let query = supabaseAdmin
    .from("kfy_products")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(params.limit + 1);

  if (params.status) {
    query = query.in("status", params.status.split(","));
  }
  if (cursor) {
    query = query.or(
      `and(created_at.lt.${cursor.createdAt}),and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao consultar produtos: ${error.message}`);
  }
  const productRows = z.array(productRowSchema).parse(data ?? []);

  const hasNextPage = productRows.length > params.limit;
  const rows = hasNextPage ? productRows.slice(0, -1) : productRows;

  const summary = new Map<
    number,
    { orders: number; grossCents: number }
  >();

  if (rows.length) {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("kfy_orders")
      .select("product_id,status,gross_cents")
      .in("product_id", rows.map((row) => row.id));

    if (ordersError) {
      throw new Error(`Erro ao agregar pedidos por produto: ${ordersError.message}`);
    }

    for (const order of z.array(orderSummarySchema).parse(orders ?? [])) {
      const entry = summary.get(order.product_id) ?? { orders: 0, grossCents: 0 };
      entry.orders += 1;
      if (order.status === "approved") {
        entry.grossCents += Number(order.gross_cents ?? 0);
      }
      summary.set(order.product_id, entry);
    }
  }

  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      externalId: row.external_id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      priceCents: row.price_cents,
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metrics: summary.get(row.id) ?? { orders: 0, grossCents: 0 },
    })),
    nextCursor: hasNextPage && rows.length ? encodeCursor(rows[rows.length - 1]) : null,
  });
}

export async function POST(request: NextRequest) {
  assertIsAdmin(request);
  if (!mutationsEnabled) {
    return NextResponse.json(
      { ok: false, message: "Criação de produtos não disponível na API" },
      { status: 405 },
    );
  }
  const body = await request.json();
  const payload = productPayloadSchema.parse(body) as Partial<KfyProduct>;
  const product = await createProduct(payload);
  return NextResponse.json({ ok: true, product });
}

export async function PUT(request: NextRequest) {
  assertIsAdmin(request);
  if (!mutationsEnabled) {
    return NextResponse.json(
      { ok: false, message: "Atualização de produtos não disponível na API" },
      { status: 405 },
    );
  }
  const body = await request.json();
  const payload = productPayloadSchema.parse(body) as Partial<KfyProduct>;
  if (!payload.externalId) {
    return NextResponse.json({ ok: false, message: "externalId é obrigatório" }, { status: 400 });
  }
  const product = await updateProduct(payload.externalId, payload);
  return NextResponse.json({ ok: true, product });
}

export async function DELETE(request: NextRequest) {
  assertIsAdmin(request);
  if (!mutationsEnabled) {
    return NextResponse.json(
      { ok: false, message: "Remoção de produtos não disponível na API" },
      { status: 405 },
    );
  }
  const body = await request.json();
  const schema = z.object({ externalId: z.string() });
  const { externalId } = schema.parse(body);
  await deleteProduct(externalId);
  return NextResponse.json({ ok: true });
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
