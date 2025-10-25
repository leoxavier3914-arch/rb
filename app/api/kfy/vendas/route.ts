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

const dateParamSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  },
  z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "Data inválida (use YYYY-MM-DD)"),
);

const commaSeparatedStrings = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const tokens = value
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    return tokens.length ? tokens : undefined;
  },
  z.array(z.string()).optional(),
);

const commaSeparatedNumbers = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const tokens = value
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    if (!tokens.length) {
      return undefined;
    }
    return tokens.map((token) => Number.parseInt(token, 10));
  },
  z
    .array(
      z
        .number({ invalid_type_error: "IDs de produto devem ser numéricos" })
        .int("IDs de produto devem ser inteiros")
        .nonnegative("IDs de produto devem ser positivos"),
    )
    .optional(),
);

const searchSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  },
  z.string().max(200, "Busca muito longa").optional(),
);

const cursorSchema = z
  .string()
  .transform((value, ctx) => {
    const [createdAt, idPart] = value.split("::");
    if (!createdAt || !idPart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cursor inválido",
      });
      return z.NEVER;
    }

    const parsed = Number.parseInt(idPart, 10);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cursor inválido",
      });
      return z.NEVER;
    }

    return { createdAt, id: parsed };
  })
  .optional();

const querySchema = z
  .object({
    limit: z.coerce.number().min(1).max(100).default(50),
    cursor: cursorSchema,
    status: commaSeparatedStrings,
    paymentMethod: commaSeparatedStrings,
    productId: commaSeparatedNumbers,
    search: searchSchema,
    from: dateParamSchema,
    to: dateParamSchema,
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"to" deve ser maior ou igual a "from"',
        path: ["to"],
      });
    }
  });

function encodeCursor(row: { created_at: string; id: number }) {
  return `${row.created_at}::${row.id}`;
}

export async function GET(request: NextRequest) {
  assertIsAdmin(request);
  const parseResult = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Parâmetros inválidos",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const params = parseResult.data;

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
    query = query.in("status", params.status);
  }
  if (params.paymentMethod) {
    query = query.in("payment_method", params.paymentMethod);
  }
  if (params.productId) {
    query = query.in("product_id", params.productId);
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
  if (params.cursor) {
    query = query.or(
      `and(created_at.lt.${params.cursor.createdAt}),and(created_at.eq.${params.cursor.createdAt},id.lt.${params.cursor.id})`,
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
export const dynamic = "force-dynamic";
export const revalidate = 0;
