import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  assertIsAdmin: vi.fn(),
}));

const upsertMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase", () => {
  const chain = {
    upsert: upsertMock,
    select: vi.fn(() => ({
      in: vi.fn(async () => ({ data: [], error: null })),
    })),
    in: vi.fn(() => ({ select: vi.fn(async () => ({ data: [], error: null })) })),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };

  return {
    supabaseAdmin: {
      from: vi.fn(() => chain),
    },
  };
});

const productResponse = {
  data: [
    {
      id: "prod-1",
      title: "Produto",
      description: null,
      price_cents: 1000,
      currency: "BRL",
      status: "approved",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ],
};

const saleResponse = {
  sales: [
    {
      id: "sale-1",
      product_id: "prod-1",
      customer_id: "cust-1",
      status: "approved",
      payment_method: "pix",
      amount_gross: 1000,
      amount_fee: 100,
      amount_net: 900,
      amount_commission: 50,
      currency: "BRL",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T01:00:00Z",
      approved_at: "2024-01-01T00:30:00Z",
      customer: {
        id: "cust-1",
        name: "Cliente",
        email: "cliente@example.com",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      product: {
        id: "prod-1",
        title: "Produto",
        price_cents: 1000,
        currency: "BRL",
        status: "approved",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    },
  ],
  summary: {
    range: { startDate: "2024-01-01", endDate: "2024-01-31" },
    totalIntervals: 1,
    totalPages: 1,
    totalSales: 1,
  },
};

vi.mock("@/lib/kiwify/resources", () => ({
  listProducts: vi.fn(async () => productResponse),
  extractCollection: (payload: unknown) => {
    if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
      return (payload as { data: unknown[] }).data;
    }
    return Array.isArray(payload) ? payload : [];
  },
  shouldRequestNextPage: () => false,
  fetchAllSalesByWindow: vi.fn(async () => saleResponse),
}));

// Import after mocks
const { POST } = await import("@/app/api/kfy/sync/route");

describe("sync route", () => {
  it("retorna resumo de sincronização usando API pública", async () => {
    const request = new NextRequest("http://localhost/api/kfy/sync");
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.summary.products).toBe(1);
    expect(body.summary.customers).toBe(1);
    expect(body.summary.orders).toBe(1);
    expect(body.summary.sales).toBe(1);
    expect(upsertMock).toHaveBeenCalled();
  });
});
