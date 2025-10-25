import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let fetchMock: ReturnType<typeof vi.fn>;

describe("kfyClient", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    // @ts-expect-error - override global fetch for tests
    global.fetch = fetchMock;
    vi.resetModules();
    vi.stubEnv("KIWIFY_CLIENT_ID", "client");
    vi.stubEnv("KIWIFY_CLIENT_SECRET", "secret");
    vi.stubEnv("KIWIFY_ACCOUNT_ID", "account");
    vi.stubEnv("KIWIFY_API_URL", "https://example.com");
  });

  it("obtem e reaproveita token", async () => {
    const tokenResponse = { access_token: "token", expires_in: 3600, token_type: "Bearer" };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => tokenResponse,
      headers: new Headers({ "content-type": "application/json" }),
    });

    const mod = await import("@/lib/kfyClient");
    mod.__resetKfyClientStateForTesting();
    const { getAccessToken } = mod;

    const tokenA = await getAccessToken();
    const tokenB = await getAccessToken();

    expect(tokenA).toBe("token");
    expect(tokenB).toBe("token");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect([
      "https://example.com/oauth/token",
      "https://example.com/v1/oauth/token",
    ]).toContain(tokenUrl.toString?.() ?? tokenUrl);
    expect(tokenInit?.method).toBe("POST");
    expect(tokenInit?.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(tokenInit?.body).toBeInstanceOf(URLSearchParams);
    expect(Object.fromEntries((tokenInit?.body as URLSearchParams).entries())).toEqual({
      grant_type: "client_credentials",
      client_id: "client",
      client_secret: "secret",
      account_id: "account",
    });
  });

  it("normaliza status e métodos de pagamento em listagem de pedidos", async () => {
    const tokenResponse = { access_token: "token", expires_in: 3600, token_type: "Bearer" };
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
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => tokenResponse,
        headers: new Headers({ "content-type": "application/json" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => ordersResponse,
        headers: new Headers({ "content-type": "application/json" }),
      });

    const mod = await import("@/lib/kfyClient");
    mod.__resetKfyClientStateForTesting();

    const result = await mod.listOrders();

    expect(result.items[0].status).toBe("approved");
    expect(result.items[0].paymentMethod).toBe("card");
    expect(result.nextCursor).toBeNull();

    const [, requestInit] = fetchMock.mock.calls[1]!;
    const headers = requestInit?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("x-kiwify-account-id")).toBe("account");
  });

  it("tenta caminhos alternativos quando recebe 404", async () => {
    vi.stubEnv("KIWIFY_API_URL", "https://example.com/v1/");

    const tokenResponse = { access_token: "token", expires_in: 3600, token_type: "Bearer" };
    const notFoundResponse = {
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/html" }),
      text: () => Promise.resolve("Cannot GET"),
    };
    const emptyResponse = {
      ok: true,
      status: 200,
      json: () => ({ data: [], cursor: { next: null } }),
      headers: new Headers({ "content-type": "application/json" }),
    };

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => tokenResponse,
        headers: new Headers({ "content-type": "application/json" }),
      })
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValueOnce({ ...notFoundResponse })
      .mockResolvedValueOnce(emptyResponse);

    const mod = await import("@/lib/kfyClient");
    mod.__resetKfyClientStateForTesting();

    const result = await mod.listCustomers();
    expect(result.items).toHaveLength(0);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const firstUrl = String(fetchMock.mock.calls[1]![0]);
    const secondUrl = String(fetchMock.mock.calls[2]![0]);
    const thirdUrl = String(fetchMock.mock.calls[3]![0]);

    expect(firstUrl).toBe("https://example.com/v1/customers");
    expect(secondUrl).toBe("https://example.com/customers");
    expect(thirdUrl).toBe("https://example.com/api/v1/customers");
  });
});
