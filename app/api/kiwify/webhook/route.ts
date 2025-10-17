import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  detectEventKind,
  normalizeAbandonedCart,
  normalizeApprovedSale,
  normalizePendingPayment,
  normalizeRejectedPayment,
  normalizeRefundedSale,
  normalizeSubscriptionEvent,
  type EventKind,
  type NormalizedAbandonedCart,
  type NormalizedApprovedSale,
  type NormalizedPendingPayment,
  type NormalizedRejectedPayment,
  type NormalizedRefundedSale,
  type NormalizedSubscriptionEvent,
} from "@/lib/kiwify";
import { getSupabaseAdmin } from "@/lib/supabase";
import { kiwifyWebhookEnv } from "@/lib/env";

type JsonRecord = Record<string, unknown>;

type NormalizedPayload =
  | { kind: "approved_sale"; value: NormalizedApprovedSale }
  | { kind: "pending_payment"; value: NormalizedPendingPayment }
  | { kind: "rejected_payment"; value: NormalizedRejectedPayment }
  | { kind: "refunded_sale"; value: NormalizedRefundedSale }
  | { kind: "abandoned_cart"; value: NormalizedAbandonedCart }
  | { kind: "subscription_event"; value: NormalizedSubscriptionEvent };

type NormalizedByKind = {
  approved_sale: NormalizedApprovedSale;
  pending_payment: NormalizedPendingPayment;
  rejected_payment: NormalizedRejectedPayment;
  refunded_sale: NormalizedRefundedSale;
  abandoned_cart: NormalizedAbandonedCart;
  subscription_event: NormalizedSubscriptionEvent;
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
      gross_amount: sale.grossAmount,
      net_amount: sale.netAmount,
      kiwify_commission_amount: sale.kiwifyCommissionAmount,
      affiliate_commission_amount: sale.affiliateCommissionAmount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      status: sale.status,
      role: sale.role,
      customer_phone: sale.customerPhone,
      customer_document: sale.customerDocument,
      customer_ip: sale.customerIp,
      utm_source: sale.utmSource,
      utm_medium: sale.utmMedium,
      utm_campaign: sale.utmCampaign,
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
      gross_amount: sale.grossAmount,
      net_amount: sale.netAmount,
      kiwify_commission_amount: sale.kiwifyCommissionAmount,
      affiliate_commission_amount: sale.affiliateCommissionAmount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      status: sale.status,
      role: sale.role,
      customer_phone: sale.customerPhone,
      customer_document: sale.customerDocument,
      customer_ip: sale.customerIp,
      utm_source: sale.utmSource,
      utm_medium: sale.utmMedium,
      utm_campaign: sale.utmCampaign,
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
      gross_amount: sale.grossAmount,
      net_amount: sale.netAmount,
      kiwify_commission_amount: sale.kiwifyCommissionAmount,
      affiliate_commission_amount: sale.affiliateCommissionAmount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      status: sale.status,
      role: sale.role,
      customer_phone: sale.customerPhone,
      customer_document: sale.customerDocument,
      customer_ip: sale.customerIp,
      utm_source: sale.utmSource,
      utm_medium: sale.utmMedium,
      utm_campaign: sale.utmCampaign,
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
      gross_amount: sale.grossAmount,
      net_amount: sale.netAmount,
      kiwify_commission_amount: sale.kiwifyCommissionAmount,
      affiliate_commission_amount: sale.affiliateCommissionAmount,
      currency: sale.currency,
      payment_method: sale.paymentMethod,
      status: sale.status,
      role: sale.role,
      customer_phone: sale.customerPhone,
      customer_document: sale.customerDocument,
      customer_ip: sale.customerIp,
      utm_source: sale.utmSource,
      utm_medium: sale.utmMedium,
      utm_campaign: sale.utmCampaign,
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
      gross_amount: cart.grossAmount,
      net_amount: cart.netAmount,
      kiwify_commission_amount: cart.kiwifyCommissionAmount,
      affiliate_commission_amount: cart.affiliateCommissionAmount,
      currency: cart.currency,
      checkout_url: cart.checkoutUrl,
      status: cart.status,
      occurred_at: cart.occurredAt,
      payload: cart.payload,
    }),
  }),
  subscription_event: () => ({
    table: "subscription_events",
    buildRow: (event) => ({
      event_reference: event.eventReference,
      subscription_id: event.subscriptionId,
      sale_id: event.saleId,
      customer_name: event.customerName,
      customer_email: event.customerEmail,
      product_name: event.productName,
      amount: event.amount,
      gross_amount: event.grossAmount,
      net_amount: event.netAmount,
      kiwify_commission_amount: event.kiwifyCommissionAmount,
      affiliate_commission_amount: event.affiliateCommissionAmount,
      currency: event.currency,
      payment_method: event.paymentMethod,
      event_type: event.eventType,
      subscription_status: event.subscriptionStatus,
      occurred_at: event.occurredAt,
      payload: event.payload,
    }),
  }),
};

const getUpsertConfig = <K extends EventKind>(kind: K): UpsertConfig<K> =>
  normalizeMap[kind]();

const ON_CONFLICT = { onConflict: "event_reference" } as const;

const normalizeSignature = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/^(["'])(.*)\1$/, "$2").replace(/\s+/g, "").toLowerCase();
};

const buildSignature = (rawBody: string, secret: string) =>
  createHmac("sha1", secret).update(rawBody).digest("hex");

const isSignatureValid = (rawBody: string, provided: string | null, secret: string) => {
  if (!provided) {
    return false;
  }

  try {
    const expected = buildSignature(rawBody, secret);
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(provided, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch (error) {
    console.error("Assinatura inválida", error);
    return false;
  }
};

const parseBody = (rawBody: string): JsonRecord | null => {
  try {
    const body = JSON.parse(rawBody);
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
    case "subscription_event":
      return { kind, value: normalizeSubscriptionEvent(payload) };
  }
};

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let env;
  try {
    env = kiwifyWebhookEnv.get();
  } catch (error) {
    console.error("Variáveis de ambiente ausentes", error);
    return NextResponse.json({ error: "Configuração do servidor ausente" }, { status: 500 });
  }

  const url = new URL(request.url);
  const providedSignature = normalizeSignature(url.searchParams.get("signature"));
  const rawBody = await request.text();

  if (!providedSignature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  if (!isSignatureValid(rawBody, providedSignature, env.KIWIFY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  const payload = parseBody(rawBody);
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
    const { error } = await supabase
      .from(config.table)
      .upsert(config.buildRow(normalized.value), ON_CONFLICT);

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
