import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertIsAdmin } from "@/lib/auth";
import {
  listCoupons,
  listCustomers,
  listEnrollments,
  listOrders,
  listProducts,
  listRefunds,
} from "@/lib/kfyClient";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  KfyCoupon,
  KfyCustomer,
  KfyEnrollment,
  KfyOrder,
  KfyProduct,
  KfyRefund,
} from "@/types/kfy";

const querySchema = z.object({
  full: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const MAX_CHUNK = 500;

type SyncWindow = {
  full: boolean;
  from?: string;
  to?: string;
};

async function chunkedUpsert<T>(table: string, rows: T[]) {
  for (let index = 0; index < rows.length; index += MAX_CHUNK) {
    const chunk = rows.slice(index, index + MAX_CHUNK);
    const { error } = await supabaseAdmin.from(table).upsert(chunk, {
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
    const { error } = await supabaseAdmin.from(table).upsert(chunk, {
      onConflict: "type,external_id",
    });
    if (error) {
      throw new Error(`Erro ao registrar eventos ${table}: ${error.message}`);
    }
  }
}

async function collectAll<T>(
  fetcher: (options: { cursor?: string | null; dateFrom?: string; dateTo?: string }) => Promise<{
    items: T[];
    nextCursor: string | null;
  }>,
  options: SyncWindow,
): Promise<T[]> {
  const accumulator: T[] = [];
  let cursor: string | null | undefined = null;
  do {
    const { items, nextCursor } = await fetcher({
      cursor,
      dateFrom: options.full ? undefined : options.from,
      dateTo: options.full ? undefined : options.to,
    });
    accumulator.push(...items);
    cursor = nextCursor;
  } while (cursor);
  return accumulator;
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
  return new Map(data.map((row) => [row.external_id as string, row.id as number]));
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

async function mapRefunds(refunds: KfyRefund[]) {
  const orderIds = await buildIdMap(
    "kfy_orders",
    refunds.map((refund) => refund.orderExternalId),
  );

  return refunds
    .map((refund) => {
      const orderId = orderIds.get(refund.orderExternalId);
      if (!orderId) return null;
      return {
        external_id: refund.externalId,
        order_id: orderId,
        reason: refund.reason,
        amount_cents: refund.amountCents,
        status: refund.status,
        created_at: refund.createdAt.toISOString(),
        processed_at: refund.processedAt?.toISOString() ?? null,
        raw: refund.raw ?? {},
      };
    })
    .filter(Boolean);
}

async function mapEnrollments(enrollments: KfyEnrollment[]) {
  const productIds = await buildIdMap(
    "kfy_products",
    enrollments.map((enrollment) => enrollment.productExternalId),
  );
  const customerIds = await buildIdMap(
    "kfy_customers",
    enrollments.map((enrollment) => enrollment.customerExternalId),
  );

  return enrollments
    .map((enrollment) => {
      const productId = productIds.get(enrollment.productExternalId);
      const customerId = customerIds.get(enrollment.customerExternalId);
      if (!productId || !customerId) return null;
      return {
        external_id: enrollment.externalId,
        product_id: productId,
        customer_id: customerId,
        status: enrollment.status,
        started_at: enrollment.startedAt?.toISOString() ?? null,
        expires_at: enrollment.expiresAt?.toISOString() ?? null,
        created_at: enrollment.createdAt.toISOString(),
        updated_at: enrollment.updatedAt.toISOString(),
        raw: enrollment.raw ?? {},
      };
    })
    .filter(Boolean);
}

function mapCoupons(coupons: KfyCoupon[]) {
  return coupons.map((coupon) => ({
    external_id: coupon.externalId,
    code: coupon.code,
    type: coupon.type,
    value_cents_or_percent: coupon.value,
    active: coupon.active,
    created_at: coupon.createdAt.toISOString(),
    updated_at: coupon.updatedAt.toISOString(),
    raw: coupon.raw ?? {},
  }));
}

function buildEventPayload(type: string, payload: Record<string, unknown>[]) {
  return payload.map((row) => ({
    type,
    external_id: String(row.external_id),
    payload: row,
    occurred_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  }));
}

export async function POST(request: NextRequest) {
  assertIsAdmin(request);

  const url = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
  const window: SyncWindow = {
    full: query.full === "true" || (!query.from && !query.to),
    from: query.from ?? undefined,
    to: query.to ?? undefined,
  };

  const [products, customers] = await Promise.all([
    collectAll(listProducts, window),
    collectAll(listCustomers, window),
  ]);

  await chunkedUpsert("kfy_products", mapProducts(products));
  await chunkedUpsert("kfy_customers", mapCustomers(customers));

  const [orders, refunds, enrollments, coupons] = await Promise.all([
    collectAll(listOrders, window),
    collectAll(listRefunds, window),
    collectAll(listEnrollments, window),
    collectAll(listCoupons, window),
  ]);

  const mappedOrders = await mapOrders(orders);
  await chunkedUpsert("kfy_orders", mappedOrders);

  const mappedRefunds = await mapRefunds(refunds);
  await chunkedUpsert("kfy_refunds", mappedRefunds);

  const mappedEnrollments = await mapEnrollments(enrollments);
  await chunkedUpsert("kfy_enrollments", mappedEnrollments);

  await chunkedUpsert("kfy_coupons", mapCoupons(coupons));

  const events = [
    ...buildEventPayload("product", mapProducts(products)),
    ...buildEventPayload("customer", mapCustomers(customers)),
    ...buildEventPayload("order", mappedOrders as any),
    ...buildEventPayload("refund", mappedRefunds as any),
    ...buildEventPayload("enrollment", mappedEnrollments as any),
    ...buildEventPayload("coupon", mapCoupons(coupons)),
  ];

  if (events.length) {
    await chunkedInsert("kfy_events", events);
  }

  return NextResponse.json({
    ok: true,
    summary: {
      products: products.length,
      customers: customers.length,
      orders: orders.length,
      refunds: refunds.length,
      enrollments: enrollments.length,
      coupons: coupons.length,
    },
  });
}
