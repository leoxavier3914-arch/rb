import { NextResponse } from "next/server";
import {
  detectEventKind,
  normalizeAbandonedCart,
  normalizeApprovedSale,
  normalizePendingPayment,
  normalizeRejectedPayment,
  normalizeRefundedSale,
  type EventKind,
  type NormalizedAbandonedCart,
  type NormalizedApprovedSale,
  type NormalizedPendingPayment,
  type NormalizedRejectedPayment,
  type NormalizedRefundedSale,
} from "@/lib/kiwify";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEnv } from "@/lib/env";

type JsonRecord = Record<string, unknown>;

type NormalizedPayload =
  | { kind: "approved_sale"; value: NormalizedApprovedSale }
  | { kind: "pending_payment"; value: NormalizedPendingPayment }
  | { kind: "rejected_payment"; value: NormalizedRejectedPayment }
  | { kind: "refunded_sale"; value: NormalizedRefundedSale }
  | { kind: "abandoned_cart"; value: NormalizedAbandonedCart };

type NormalizedByKind = {
  approved_sale: NormalizedApprovedSale;
  pending_payment: NormalizedPendingPayment;
  rejected_payment: NormalizedRejectedPayment;
  refunded_sale: NormalizedRefundedSale;
  abandoned_cart: NormalizedAbandonedCart;
};

type UpsertConfig<K extends EventKind> = {
  table: string;
  buildRow: (payload: NormalizedByKind[K]) => JsonRecord;
};

const normalizeMap: { [K in EventKind]: () => UpsertConfig<K> } = {
  approved_sale: () => ({
    table: "approved_sales",
    buildRow: (sale) => ({
      event_reference: sale.eventReference,
      sale_id: sale.saleId,
      customer_name: sale.customerName,
      customer_email: sale.customerEmail,
      product_name: sale.productName,
      amount: sale.amount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      occurred_at: sale.occurredAt,
      payload: sale.payload,
    }),
  }),
  pending_payment: () => ({
    table: "pending_payments",
    buildRow: (sale) => ({
      event_reference: sale.eventReference,
      sale_id: sale.saleId,
      customer_name: sale.customerName,
      customer_email: sale.customerEmail,
      product_name: sale.productName,
      amount: sale.amount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      occurred_at: sale.occurredAt,
      payload: sale.payload,
    }),
  }),
  rejected_payment: () => ({
    table: "rejected_payments",
    buildRow: (sale) => ({
      event_reference: sale.eventReference,
      sale_id: sale.saleId,
      customer_name: sale.customerName,
      customer_email: sale.customerEmail,
      product_name: sale.productName,
      amount: sale.amount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      occurred_at: sale.occurredAt,
      payload: sale.payload,
    }),
  }),
  refunded_sale: () => ({
    table: "refunded_sales",
    buildRow: (sale) => ({
      event_reference: sale.eventReference,
      sale_id: sale.saleId,
      customer_name: sale.customerName,
      customer_email: sale.customerEmail,
      product_name: sale.productName,
      amount: sale.amount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      occurred_at: sale.occurredAt,
      payload: sale.payload,
    }),
  }),
  abandoned_cart: () => ({
    table: "abandoned_carts",
    buildRow: (cart) => ({
      event_reference: cart.eventReference,
      cart_id: cart.cartId,
      customer_name: cart.customerName,
      customer_email: cart.customerEmail,
      product_name: cart.productName,
      amount: cart.amount,
      currency: cart.currency,
      checkout_url: cart.checkoutUrl,
      status: cart.status,
      occurred_at: cart.occurredAt,
      payload: cart.payload,
    }),
  }),
};

const getUpsertConfig = <K extends EventKind>(kind: K): UpsertConfig<K> =>
  normalizeMap[kind]();

const ON_CONFLICT = { onConflict: "event_reference" } as const;

const sanitizeToken = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fromBearer = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (fromBearer) {
    return sanitizeToken(fromBearer[1]);
  }

  const fromToken = /^Token\s+token\s*=\s*(.+)$/i.exec(trimmed);
  if (fromToken) {
    return sanitizeToken(fromToken[1]);
  }

  const withoutPrefix = /^token\s*=\s*(.+)$/i.exec(trimmed);
  const candidate = withoutPrefix ? withoutPrefix[1] : trimmed;

  return candidate.replace(/^(["'])(.*)\1$/, "$2");
};

const extractToken = (headers: Headers): string | null => {
  const headerCandidates = [
    headers.get("authorization"),
    headers.get("x-kiwify-token"),
    headers.get("token"),
  ];

  for (const candidate of headerCandidates) {
    const token = sanitizeToken(candidate);
    if (token) {
      return token;
    }
  }

  return null;
};

const parseBody = async (request: Request): Promise<JsonRecord | null> => {
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      return body as JsonRecord;
    }
  } catch (error) {
    console.error("Falha ao interpretar payload", error);
  }

  return null;
};

const normalizePayload = (kind: EventKind, payload: JsonRecord): NormalizedPayload => {
  switch (kind) {
    case "approved_sale":
      return { kind, value: normalizeApprovedSale(payload) };
    case "pending_payment":
      return { kind, value: normalizePendingPayment(payload) };
    case "rejected_payment":
      return { kind, value: normalizeRejectedPayment(payload) };
    case "refunded_sale":
      return { kind, value: normalizeRefundedSale(payload) };
    case "abandoned_cart":
      return { kind, value: normalizeAbandonedCart(payload) };
  }
};

export async function POST(request: Request) {
  let env;
  try {
    env = getEnv();
  } catch (error) {
    console.error("Variáveis de ambiente ausentes", error);
    return NextResponse.json({ error: "Configuração do servidor ausente" }, { status: 500 });
  }

  const providedToken = extractToken(request.headers);
  if (!providedToken || providedToken !== env.KIWIFY_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const payload = await parseBody(request);
  if (!payload) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const kind = detectEventKind(payload);
  if (!kind) {
    return NextResponse.json({ error: "Evento desconhecido" }, { status: 422 });
  }

  const normalized = normalizePayload(kind, payload);
  const config = getUpsertConfig(kind);

  const supabase = getSupabaseAdmin();

  try {
    const { error } = await supabase.from(config.table).upsert(config.buildRow(normalized.value), ON_CONFLICT);

    if (error) {
      console.error("Erro ao gravar evento do webhook", error);
      throw error;
    }

    return NextResponse.json({ ok: true, type: normalized.kind });
  } catch (error) {
    console.error("Erro ao processar webhook", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
