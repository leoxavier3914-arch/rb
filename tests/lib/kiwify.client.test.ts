import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/kiwify/client", () => ({
  getAccessToken: vi.fn(),
}));

const { getAccessToken } = await import("@/lib/kiwify/client");
const { kiwifyFetch } = await import("@/lib/kiwify/http");

const ORIGINAL_FETCH = global.fetch;

describe("kiwifyFetch", () => {
  beforeEach(() => {
    process.env.KIWIFY_API_BASE_URL = "https://public-api.kiwify.com";
    process.env.KIWIFY_ACCOUNT_ID = "account-1";
    (getAccessToken as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    delete process.env.KIWIFY_API_BASE_URL;
    delete process.env.KIWIFY_ACCOUNT_ID;
  });

  it("refaz a requisição com refresh do token quando recebe 401", async () => {
    const tokenMock = getAccessToken as unknown as ReturnType<typeof vi.fn>;
    tokenMock.mockResolvedValueOnce("token-1");
    tokenMock.mockResolvedValueOnce("token-2");
    tokenMock.mockResolvedValue("token-2");

    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("authorization")).toBe("Bearer token-1");
        expect(headers.get("x-kiwify-account-id")).toBe("account-1");
        return new Response("unauthorized", { status: 401 });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("authorization")).toBe("Bearer token-2");
        expect(headers.get("x-kiwify-account-id")).toBe("account-1");
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await kiwifyFetch("/v1/products");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).toHaveBeenNthCalledWith(1, false);
    expect(tokenMock).toHaveBeenNthCalledWith(2, true);
    expect(tokenMock).toHaveBeenNthCalledWith(3, false);
  });
});
