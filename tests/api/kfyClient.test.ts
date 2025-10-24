import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.stubEnv("KIWIFY_CLIENT_ID", "client");
vi.stubEnv("KIWIFY_CLIENT_SECRET", "secret");
vi.stubEnv("KIWIFY_ACCOUNT_ID", "account");
vi.stubEnv("KIWIFY_API_URL", "https://example.com");

let fetchMock: ReturnType<typeof vi.fn>;

describe("kfyClient", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    // @ts-expect-error - override global fetch for tests
    global.fetch = fetchMock;
    vi.resetModules();
  });

  it("obtem e reaproveita token", async () => {
    const tokenResponse = { access_token: "token", expires_in: 3600 };
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => tokenResponse });

    const { getAccessToken } = await import("@/lib/kfyClient");

    const tokenA = await getAccessToken();
    const tokenB = await getAccessToken();

    expect(tokenA).toBe("token");
    expect(tokenB).toBe("token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normaliza status e métodos de pagamento em listagem de pedidos", async () => {
    const tokenResponse = { access_token: "token", expires_in: 3600 };
    const ordersResponse = {
      data: [
        {
          id: "1",
          product_id: "p1",
          customer_id: "c1",
          status: "paid",
          payment_method: "credit_card",
          amount_gross: 1000,
          amount_fee: 100,
          amount_net: 900,
          amount_commission: 50,
          currency: "BRL",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      cursor: { next: null },
    };

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => tokenResponse })
      .mockResolvedValueOnce({ ok: true, json: () => ordersResponse });

    const { listOrders } = await import("@/lib/kfyClient");

    const result = await listOrders();
    expect(result.items[0].status).toBe("approved");
    expect(result.items[0].paymentMethod).toBe("card");
    expect(result.nextCursor).toBeNull();
  });
});
