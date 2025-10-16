import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetEnvForTesting } from "@/lib/env";

type OperationRecord = { payload: unknown; options: unknown };
const operations: Record<string, OperationRecord[]> = {};

vi.mock("@/lib/supabase", () => {
  const supabaseClient = {
    from: (table: string) => ({
      upsert: async (payload: unknown, options?: unknown) => {
        operations[table] ??= [];
        operations[table].push({ payload, options });
        return { data: null, error: null };
      },
    }),
  };

  return {
    getSupabaseAdmin: () => supabaseClient,
  };
});

const SECRET = "test-secret";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.KIWIFY_WEBHOOK_SECRET = SECRET;

let POST: typeof import("./route").POST;
let HEAD: typeof import("./route").HEAD;

beforeAll(async () => {
  ({ POST, HEAD } = await import("./route"));
});

beforeEach(() => {
  Object.keys(operations).forEach((table) => {
    delete operations[table];
  });
  __resetEnvForTesting();
});

const signRaw = (raw: string, secret: string) =>
  createHmac("sha1", secret).update(raw).digest("hex");

const signPayload = (payload: Record<string, unknown>, secret = SECRET) =>
  signRaw(JSON.stringify(payload), secret);

type CallOptions = {
  signature?: string | null;
  overrideSecret?: string;
};

const callWebhook = async (
  payload: Record<string, unknown>,
  options: CallOptions = {},
) => {
  const body = JSON.stringify(payload);
  const url = new URL("http://localhost/api/kiwify/webhook");

  const signature =
    options.signature !== undefined
      ? options.signature
      : signPayload(payload, options.overrideSecret ?? SECRET);

  if (signature) {
    url.searchParams.set("signature", signature);
  }

  const request = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  return POST(request);
};

describe("/api/kiwify/webhook", () => {
  it("retorna 200 em requisições HEAD", async () => {
    const response = await HEAD();
    expect(response.status).toBe(200);
  });

  it("armazena vendas aprovadas seguindo o layout da documentação", async () => {
    const payload = {
      order_id: "sale-approved",
      order_ref: "Quzqwus",
      order_status: "paid",
      webhook_event_type: "order_approved",
      payment_method: "credit_card",
      approved_date: "2024-12-23T15:58:00Z",
      Customer: { full_name: "Alice", email: "alice@example.com" },
      Product: { product_name: "Curso de Testes" },
      Commissions: { charge_amount: 19990, currency: "BRL" },
    };

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
    expect(operations.approved_sales).toHaveLength(1);
    const stored = operations.approved_sales?.[0].payload as Record<string, unknown>;
    expect(stored.sale_id).toBe("sale-approved");
    expect(stored.payment_method).toBe("credit_card");
    expect(stored.currency).toBe("BRL");
    expect(stored.amount).toBeCloseTo(199.9, 3);
  });

  it("classifica eventos pix_created como pagamentos pendentes", async () => {
    const payload = {
      order_id: "pending-sale",
      order_status: "waiting_payment",
      webhook_event_type: "pix_created",
      payment_method: "pix",
      created_at: "2024-12-22T10:00:00Z",
      Customer: { full_name: "Bruno", email: "bruno@example.com" },
      Product: { product_name: "Curso de Backend" },
      Commissions: { charge_amount: 5990, currency: "BRL" },
    };

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("pending_payment");
    expect(operations.pending_payments).toHaveLength(1);
    const stored = operations.pending_payments?.[0].payload as Record<string, unknown>;
    expect(stored.sale_id).toBe("pending-sale");
    expect(stored.amount).toBeCloseTo(59.9, 3);
    expect(operations.approved_sales).toBeUndefined();
  });

  it("armazena compras recusadas em rejected_payments", async () => {
    const payload = {
      order_id: "sale-refused",
      order_status: "refused",
      webhook_event_type: "order_rejected",
      card_rejection_reason: "insufficient_funds",
      Customer: { full_name: "Clara", email: "clara@example.com" },
      Product: { product_name: "Curso de UX" },
      Commissions: { charge_amount: 14990, currency: "BRL" },
      created_at: "2024-12-21T08:30:00Z",
    };

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("rejected_payment");
    expect(operations.rejected_payments).toHaveLength(1);
    const stored = operations.rejected_payments?.[0].payload as Record<string, unknown>;
    expect(stored.sale_id).toBe("sale-refused");
  });

  it("armazena chargeback em refunded_sales", async () => {
    const payload = {
      order_id: "sale-refunded",
      order_status: "refunded",
      webhook_event_type: "chargeback",
      Customer: { full_name: "Diego", email: "diego@example.com" },
      Product: { product_name: "Curso de Design" },
      Commissions: { charge_amount: 24990, currency: "BRL" },
      updated_at: "2024-12-25T11:00:00Z",
    };

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("refunded_sale");
    expect(operations.refunded_sales).toHaveLength(1);
    const stored = operations.refunded_sales?.[0].payload as Record<string, unknown>;
    expect(stored.sale_id).toBe("sale-refunded");
  });

  it("armazena carrinhos abandonados mesmo sem webhook_event_type", async () => {
    const payload = {
      cart_id: "cart-123",
      status: "abandoned",
      checkout_link: "https://pay.kiwify.com.br/cart-123",
      Customer: { full_name: "Elaine", email: "elaine@example.com" },
      Product: { product_name: "Curso de Tráfego" },
      amount: 12990,
      currency: "BRL",
      created_at: "2024-12-20T09:00:00Z",
    };

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("abandoned_cart");
    expect(operations.abandoned_carts).toHaveLength(1);
    const stored = operations.abandoned_carts?.[0].payload as Record<string, unknown>;
    expect(stored.cart_id).toBe("cart-123");
    expect(stored.checkout_url).toBe("https://pay.kiwify.com.br/cart-123");
  });

  it("armazena eventos de assinatura em subscription_events", async () => {
    const payload = {
      order_id: "sale-subscription",
      subscription_id: "sub-001",
      webhook_event_type: "subscription_canceled",
      Subscription: { status: "canceled", updated_at: "2024-12-26T12:00:00Z" },
      Customer: { full_name: "Fernanda", email: "fernanda@example.com" },
      Product: { product_name: "Clube VIP" },
      Commissions: { charge_amount: 8900, currency: "BRL" },
    };

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("subscription_event");
    expect(operations.subscription_events).toHaveLength(1);
    const stored = operations.subscription_events?.[0].payload as Record<string, unknown>;
    expect(stored.subscription_id).toBe("sub-001");
    expect(stored.event_type).toBe("subscription_canceled");
    expect(stored.sale_id).toBe("sale-subscription");
  });

  it("retorna 400 quando a assinatura não é enviada", async () => {
    const payload = {
      order_id: "sale-approved",
      webhook_event_type: "order_approved",
      Customer: { full_name: "Alice", email: "alice@example.com" },
      Product: { product_name: "Curso" },
      Commissions: { charge_amount: 19990, currency: "BRL" },
    };

    const response = await callWebhook(payload, { signature: null });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Assinatura ausente" });
    expect(operations.approved_sales).toBeUndefined();
  });

  it("retorna 400 quando a assinatura não confere", async () => {
    const payload = {
      order_id: "sale-approved",
      webhook_event_type: "order_approved",
      Customer: { full_name: "Alice", email: "alice@example.com" },
      Product: { product_name: "Curso" },
      Commissions: { charge_amount: 19990, currency: "BRL" },
    };

    const response = await callWebhook(payload, { signature: "assinatura-invalida" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Assinatura inválida" });
    expect(operations.approved_sales).toBeUndefined();
  });

  it("retorna 400 quando o JSON é inválido", async () => {
    const rawBody = "{";
    const signature = signRaw(rawBody, SECRET);
    const url = new URL("http://localhost/api/kiwify/webhook");
    url.searchParams.set("signature", signature);

    const request = new Request(url, {
      method: "POST",
      body: rawBody,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Payload inválido" });
  });
});
