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

const TOKEN = "test-token";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.KIWIFY_WEBHOOK_TOKEN = TOKEN;

let POST: typeof import("./route").POST;

beforeAll(async () => {
  ({ POST } = await import("./route"));
});

beforeEach(() => {
  Object.keys(operations).forEach((table) => {
    delete operations[table];
  });
});

const callWebhook = async (
  payload: Record<string, unknown>,
  headers: Record<string, string> = {},
) => {
  const request = new Request("http://localhost/api/kiwify/webhook", {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  return POST(request);
};

describe("POST /api/kiwify/webhook", () => {
  it("armazena vendas aprovadas", async () => {
    const response = await callWebhook({
      event: "approved_sale",
      data: {
        id: "sale-approved",
        customer: { name: "Alice", email: "alice@example.com" },
        product: { name: "Curso" },
        amount: 199.9,
        currency: "BRL",
        payment: { method: "pix", status: "paid" },
        paid_at: "2024-05-31T12:00:00Z",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
    expect(operations.approved_sales).toBeDefined();
    expect(operations.approved_sales).toHaveLength(1);
    expect((operations.approved_sales?.[0].payload as Record<string, unknown>).sale_id).toBe(
      "sale-approved",
    );
  });

  it("armazena pagamentos pendentes em pending_payments", async () => {
    const response = await callWebhook({
      event: "pending_payment",
      data: {
        id: "sale-pending",
        customer: { name: "Bruno", email: "bruno@example.com" },
        product: { name: "Curso" },
        amount: 99.9,
        currency: "BRL",
        payment: { method: "pix", status: "pending_payment" },
        created_at: "2024-05-30T12:00:00Z",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("pending_payment");
    expect(operations.pending_payments).toBeDefined();
    expect(operations.pending_payments).toHaveLength(1);
    expect(operations.abandoned_carts).toBeUndefined();
    expect((operations.pending_payments?.[0].payload as Record<string, unknown>).sale_id).toBe(
      "sale-pending",
    );
  });

  it("aceita tokens enviados sem o prefixo Bearer", async () => {
    const response = await callWebhook(
      {
        event: "approved_sale",
        data: {
          id: "sale-approved-no-bearer",
          customer: { name: "Alice", email: "alice@example.com" },
          product: { name: "Curso" },
          amount: 199.9,
          currency: "BRL",
          payment: { method: "pix", status: "paid" },
          paid_at: "2024-05-31T12:00:00Z",
        },
      },
      { authorization: TOKEN },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
  });

  it("aceita tokens enviados no formato Token token=", async () => {
    const response = await callWebhook(
      {
        event: "approved_sale",
        data: {
          id: "sale-approved-token-token",
          customer: { name: "Alice", email: "alice@example.com" },
          product: { name: "Curso" },
          amount: 199.9,
          currency: "BRL",
          payment: { method: "pix", status: "paid" },
          paid_at: "2024-05-31T12:00:00Z",
        },
      },
      { authorization: `Token token=${TOKEN}` },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
  });

  it("aceita tokens entre aspas com prefixo Bearer", async () => {
    const response = await callWebhook(
      {
        event: "approved_sale",
        data: {
          id: "sale-approved-bearer-quoted",
          customer: { name: "Alice", email: "alice@example.com" },
          product: { name: "Curso" },
          amount: 199.9,
          currency: "BRL",
          payment: { method: "pix", status: "paid" },
          paid_at: "2024-05-31T12:00:00Z",
        },
      },
      { authorization: `Bearer "${TOKEN}"` },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
  });

  it("aceita token quando a variável de ambiente tem aspas e espaços", async () => {
    process.env.KIWIFY_WEBHOOK_TOKEN = `  "${TOKEN}"  `;
    __resetEnvForTesting();

    const response = await callWebhook(
      {
        event: "approved_sale",
        data: {
          id: "sale-approved-env-quoted",
          customer: { name: "Alice", email: "alice@example.com" },
          product: { name: "Curso" },
          amount: 199.9,
          currency: "BRL",
          payment: { method: "pix", status: "paid" },
          paid_at: "2024-05-31T12:00:00Z",
        },
      },
      { authorization: `Bearer ${TOKEN}` },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");

    process.env.KIWIFY_WEBHOOK_TOKEN = TOKEN;
    __resetEnvForTesting();
  });

  it("aceita tokens entre aspas no formato Token token=", async () => {
    const response = await callWebhook(
      {
        event: "approved_sale",
        data: {
          id: "sale-approved-token-token-quoted",
          customer: { name: "Alice", email: "alice@example.com" },
          product: { name: "Curso" },
          amount: 199.9,
          currency: "BRL",
          payment: { method: "pix", status: "paid" },
          paid_at: "2024-05-31T12:00:00Z",
        },
      },
      { authorization: `Token token="${TOKEN}"` },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
  });

  it("aceita variações de espaços e maiúsculas em Token token=", async () => {
    const response = await callWebhook(
      {
        event: "approved_sale",
        data: {
          id: "sale-approved-token-token-spaces",
          customer: { name: "Alice", email: "alice@example.com" },
          product: { name: "Curso" },
          amount: 199.9,
          currency: "BRL",
          payment: { method: "pix", status: "paid" },
          paid_at: "2024-05-31T12:00:00Z",
        },
      },
      { authorization: `TOKEN   token =   ${TOKEN}` },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
  });

  it("aceita tokens enviados no cabeçalho x-kiwify-token", async () => {
    const response = await callWebhook(
      {
        event: "approved_sale",
        data: {
          id: "sale-approved-x-kiwify-token",
          customer: { name: "Alice", email: "alice@example.com" },
          product: { name: "Curso" },
          amount: 199.9,
          currency: "BRL",
          payment: { method: "pix", status: "paid" },
          paid_at: "2024-05-31T12:00:00Z",
        },
      },
      { "x-kiwify-token": TOKEN },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("approved_sale");
  });

  it("classifica payloads com order.order_status = waiting_payment como pending_payment", async () => {
    const response = await callWebhook({
      event: "pix_created",
      order: {
        id: "order-waiting",
        order_status: "waiting_payment",
        webhook_event_type: "pix_created",
        amount: 59.9,
        currency: "BRL",
      },
      data: {
        order: {
          id: "order-waiting",
          order_status: "waiting_payment",
          webhook_event_type: "pix_created",
        },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("pending_payment");
    expect(operations.pending_payments).toBeDefined();
    expect(operations.pending_payments).toHaveLength(1);
    const pendingPayload = operations.pending_payments?.[0]
      .payload as Record<string, unknown>;
    expect(pendingPayload?.sale_id ?? null).toBeNull();
  });

  it("prefere order.order_status a order.status ao classificar pagamentos pendentes", async () => {
    const response = await callWebhook({
      event: "pix_created",
      order: {
        id: "order-waiting-priority",
        status: "pix_created",
        order_status: "waiting_payment",
        webhook_event_type: "pix_created",
        amount: 39.9,
        currency: "BRL",
      },
      data: {
        order: {
          id: "order-waiting-priority",
          status: "pix_created",
          order_status: "waiting_payment",
          webhook_event_type: "pix_created",
        },
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("pending_payment");
    expect(operations.pending_payments).toBeDefined();
    expect(operations.pending_payments).toHaveLength(1);
    const pendingPayload = operations.pending_payments?.[0]
      .payload as Record<string, unknown>;
    expect(pendingPayload?.sale_id ?? null).toBeNull();
  });

  it("armazena pagamentos recusados em rejected_payments", async () => {
    const response = await callWebhook({
      event: "refused",
      data: {
        id: "sale-refused",
        customer: { name: "Clara", email: "clara@example.com" },
        product: { name: "Curso" },
        amount: 149.9,
        currency: "BRL",
        payment: { method: "card", status: "refused" },
        created_at: "2024-05-29T12:00:00Z",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("rejected_payment");
    expect(operations.rejected_payments).toBeDefined();
    expect(operations.rejected_payments).toHaveLength(1);
    expect((operations.rejected_payments?.[0].payload as Record<string, unknown>).sale_id).toBe(
      "sale-refused",
    );
  });

  it("armazena vendas reembolsadas em refunded_sales", async () => {
    const response = await callWebhook({
      event: "chargeback",
      data: {
        id: "sale-refunded",
        customer: { name: "Diego", email: "diego@example.com" },
        product: { name: "Curso" },
        amount: 249.9,
        currency: "BRL",
        payment: { method: "card", status: "chargeback" },
        created_at: "2024-05-28T12:00:00Z",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe("refunded_sale");
    expect(operations.refunded_sales).toBeDefined();
    expect(operations.refunded_sales).toHaveLength(1);
    expect((operations.refunded_sales?.[0].payload as Record<string, unknown>).sale_id).toBe(
      "sale-refunded",
    );
  });
});
