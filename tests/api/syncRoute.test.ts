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
      group: vi.fn(async () => ({ data: [], error: null })),
    })),
    in: vi.fn(() => ({ select: vi.fn(async () => ({ data: [], error: null })), group: vi.fn(async () => ({ data: [], error: null })) })),
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

vi.mock("@/lib/kfyClient", () => ({
  listProducts: vi.fn(async () => ({
    items: [
      {
        externalId: "p1",
        title: "Produto",
        description: null,
        imageUrl: null,
        priceCents: 1000,
        currency: "BRL",
        status: "approved",
        createdAt: new Date(),
        updatedAt: new Date(),
        raw: {},
      },
    ],
    nextCursor: null,
  })),
  listCustomers: vi.fn(async () => ({
    items: [
      {
        externalId: "c1",
        name: "Cliente",
        email: "cliente@example.com",
        phone: null,
        country: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        raw: {},
      },
    ],
    nextCursor: null,
  })),
  listOrders: vi.fn(async () => ({
    items: [
      {
        externalId: "o1",
        productExternalId: "p1",
        customerExternalId: "c1",
        status: "approved",
        paymentMethod: "pix",
        grossCents: 1000,
        feeCents: 100,
        netCents: 900,
        commissionCents: 50,
        currency: "BRL",
        approvedAt: new Date(),
        refundedAt: null,
        canceledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        raw: {},
      },
    ],
    nextCursor: null,
  })),
  listRefunds: vi.fn(async () => ({ items: [], nextCursor: null })),
  listEnrollments: vi.fn(async () => ({ items: [], nextCursor: null })),
  listCoupons: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

// Re-import route after mocks
const { POST } = await import("@/app/api/kfy/sync/route");

describe("sync route", () => {
  it("retorna resumo de sincronização", async () => {
    const request = new NextRequest("http://localhost/api/kfy/sync");
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary.orders).toBe(1);
    expect(upsertMock).toHaveBeenCalled();
  });
});
