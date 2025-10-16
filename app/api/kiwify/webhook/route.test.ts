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

const setEnvVariables = () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.KIWIFY_WEBHOOK_SECRET = SECRET;
};

setEnvVariables();

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
  setEnvVariables();
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
      id: "evt-sale-approved",
      event: "order.approved",
      sent_at: "2024-12-23T15:59:00Z",
      resource: "order",
      data: {
        id: "sale-approved",
        reference: "Quzqwus",
        status: "paid",
        created_at: "2024-12-23T15:55:00Z",
        updated_at: "2024-12-23T15:58:00Z",
        amount: { value_cents: 19990, currency: "BRL" },
        commissions: {
          charge_amount: 19990,
          producer_commission: 14990,
          kiwify_commission: 5000,
          affiliate_commission: 0,
        },
        payment: { method: "credit_card", paid_at: "2024-12-23T15:58:00Z" },
        customer: { name: "Alice", email: "alice@example.com" },
        items: [{ product: { name: "Curso de Testes" } }],
      },
    } satisfies Record<string, unknown>;

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
    expect(operations.approved_sales).toHaveLength(1);
    const stored = operations.approved_sales?.[0].payload as Record<string, unknown>;
    expect(stored.sale_id).toBe("sale-approved");
    expect(stored.payment_method).toBe("credit_card");
    expect(stored.currency).toBe("BRL");
    expect(stored.amount).toBeCloseTo(149.9, 3);
    expect(stored.net_amount).toBeCloseTo(149.9, 3);
    expect(stored.gross_amount).toBeCloseTo(199.9, 3);
    expect(stored.kiwify_commission_amount).toBeCloseTo(50, 3);
    expect(stored.affiliate_commission_amount).toBeCloseTo(0, 3);
  });

  it("mantém registros distintos para webhooks com mesmo e-mail e IDs diferentes", async () => {
    const firstPayload = {
      id: "evt-sale-duplicate-1",
      event: "order.approved",
      resource: "order",
      sent_at: "2024-12-27T10:00:00Z",
      data: {
        id: "sale-duplicate-1",
        reference: "Dup-1",
        status: "paid",
        created_at: "2024-12-27T09:55:00Z",
        updated_at: "2024-12-27T09:58:00Z",
        amount: { value_cents: 10990, currency: "BRL" },
        payment: { method: "credit_card", paid_at: "2024-12-27T09:58:00Z" },
        customer: { name: "Guilherme", email: "duplicado@example.com" },
        items: [{ product: { name: "Curso Avançado" } }],
      },
    } satisfies Record<string, unknown>;

    const secondPayload = {
      id: "evt-sale-duplicate-2",
      event: "order.approved",
      resource: "order",
      sent_at: "2024-12-27T11:00:00Z",
      data: {
        id: "sale-duplicate-2",
        reference: "Dup-2",
        status: "paid",
        created_at: "2024-12-27T10:55:00Z",
        updated_at: "2024-12-27T10:58:00Z",
        amount: { value_cents: 15990, currency: "BRL" },
        payment: { method: "pix", paid_at: "2024-12-27T10:58:00Z" },
        customer: { name: "Guilherme", email: "duplicado@example.com" },
        items: [{ product: { name: "Curso Avançado" } }],
      },
    } satisfies Record<string, unknown>;

    const firstResponse = await callWebhook(firstPayload);
    const secondResponse = await callWebhook(secondPayload);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(operations.approved_sales).toHaveLength(2);

    const storedEvents = operations.approved_sales!.map((operation) =>
      operation.payload as Record<string, unknown>,
    );

    expect(storedEvents[0].event_reference).toBeDefined();
    expect(storedEvents[1].event_reference).toBeDefined();
    expect(storedEvents[0].event_reference).not.toBe(storedEvents[1].event_reference);
  });

  it("classifica eventos order.pending como pagamentos pendentes", async () => {
    const payload = {
      id: "evt-pending-sale",
      event: "Pix gerado",
      resource: "order",
      sent_at: "2024-12-22T10:05:00Z",
      data: {
        id: "pending-sale",
        status: "waiting_payment",
        created_at: "2024-12-22T10:00:00Z",
        amount: { value_cents: 5990, currency: "BRL" },
        payment: { method: "pix" },
        customer: { name: "Bruno", email: "bruno@example.com" },
        items: [{ product: { name: "Curso de Backend" } }],
      },
    } satisfies Record<string, unknown>;

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
      id: "evt-sale-refused",
      event: "Compra recusada",
      resource: "order",
      sent_at: "2024-12-21T08:40:00Z",
      data: {
        id: "sale-refused",
        status: "refused",
        created_at: "2024-12-21T08:30:00Z",
        rejection_reason: "insufficient_funds",
        amount: { value_cents: 14990, currency: "BRL" },
        customer: { name: "Clara", email: "clara@example.com" },
        items: [{ product: { name: "Curso de UX" } }],
      },
    } satisfies Record<string, unknown>;

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
      id: "evt-sale-refunded",
      event: "Reembolso",
      resource: "order",
      sent_at: "2024-12-25T11:05:00Z",
      data: {
        id: "sale-refunded",
        status: "refunded",
        updated_at: "2024-12-25T11:00:00Z",
        amount: { value_cents: 24990, currency: "BRL" },
        customer: { name: "Diego", email: "diego@example.com" },
        items: [{ product: { name: "Curso de Design" } }],
      },
    } satisfies Record<string, unknown>;

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("refunded_sale");
    expect(operations.refunded_sales).toHaveLength(1);
    const stored = operations.refunded_sales?.[0].payload as Record<string, unknown>;
    expect(stored.sale_id).toBe("sale-refunded");
  });

  it("interpreta descrição em português como pagamento pendente", async () => {
    const payload = {
      id: "evt-sale-portuguese-pending",
      event: "Boleto gerado",
      resource: "order",
      data: {
        id: "sale-portuguese-pending",
        status: "Boleto e pix aguardando pagamento",
        amount: { value_cents: 8900, currency: "BRL" },
        payment: { method: "boleto" },
        customer: { name: "Guilherme", email: "gui@example.com" },
        items: [{ product: { name: "Curso Frontend" } }],
      },
    } satisfies Record<string, unknown>;

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("pending_payment");
    expect(operations.pending_payments).toHaveLength(1);
    const stored = operations.pending_payments?.[0].payload as Record<string, unknown>;
    expect(stored.sale_id).toBe("sale-portuguese-pending");
    expect(operations.approved_sales).toBeUndefined();
  });

  it("armazena carrinhos abandonados no layout oficial", async () => {
    const payload = {
      id: "evt-cart-123",
      event: "checkout.abandoned",
      resource: "checkout",
      sent_at: "2024-12-20T09:05:00Z",
      data: {
        id: "cart-123",
        status: "abandoned",
        abandoned_at: "2024-12-20T09:00:00Z",
        checkout_url: "https://pay.kiwify.com.br/cart-123",
        amount: { value_cents: 12990, currency: "BRL" },
        customer: { name: "Elaine", email: "elaine@example.com" },
        items: [{ product: { name: "Curso de Tráfego" } }],
      },
    } satisfies Record<string, unknown>;

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
      id: "evt-subscription-canceled",
      event: "subscription.canceled",
      resource: "subscription",
      sent_at: "2024-12-26T12:05:00Z",
      data: {
        id: "sub-001",
        status: "canceled",
        order_id: "sale-subscription",
        updated_at: "2024-12-26T12:00:00Z",
        amount: { value_cents: 8900, currency: "BRL" },
        payment: { method: "credit_card" },
        customer: { name: "Fernanda", email: "fernanda@example.com" },
        product: { name: "Clube VIP" },
      },
    } satisfies Record<string, unknown>;

    const response = await callWebhook(payload);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("subscription_event");
    expect(operations.subscription_events).toHaveLength(1);
    const stored = operations.subscription_events?.[0].payload as Record<string, unknown>;
    expect(stored.subscription_id).toBe("sub-001");
    expect(stored.event_type).toBe("subscription.canceled");
    expect(stored.sale_id).toBe("sale-subscription");
  });

  it("retorna 400 quando a assinatura não é enviada", async () => {
    const payload = {
      id: "evt-sale-approved",
      event: "order.approved",
      data: {
        id: "sale-approved",
        amount: { value_cents: 19990, currency: "BRL" },
        customer: { name: "Alice", email: "alice@example.com" },
      },
    } satisfies Record<string, unknown>;

    const response = await callWebhook(payload, { signature: null });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Assinatura ausente" });
    expect(operations.approved_sales).toBeUndefined();
  });

  it("retorna 400 quando a assinatura não confere", async () => {
    const payload = {
      id: "evt-sale-approved",
      event: "order.approved",
      data: {
        id: "sale-approved",
        amount: { value_cents: 19990, currency: "BRL" },
        customer: { name: "Alice", email: "alice@example.com" },
      },
    } satisfies Record<string, unknown>;

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
