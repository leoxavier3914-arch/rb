import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasKiwifyApiEnv, mockGetKiwifyApiEnv } = vi.hoisted(() => ({
  mockHasKiwifyApiEnv: vi.fn(),
  mockGetKiwifyApiEnv: vi.fn(),
}));

vi.mock("./env", () => ({
  hasKiwifyApiEnv: mockHasKiwifyApiEnv,
  getKiwifyApiEnv: mockGetKiwifyApiEnv,
}));

import { getSalesStatistics } from "./kiwify-api";

describe("kiwifyRequest authorization header", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = (token: string) => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: token,
    KIWIFY_API_ACCOUNT_ID: "account-123",
  });

  const buildResponse = () =>
    new Response(
      JSON.stringify({
        totals: {
          gross_amount: 0,
          net_amount: 0,
          total_orders: 0,
          kiwify_commission: 0,
          affiliate_commission: 0,
          currency: "BRL",
          average_ticket: null,
        },
        breakdown: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  beforeEach(() => {
    mockHasKiwifyApiEnv.mockReset();
    mockGetKiwifyApiEnv.mockReset();

    mockHasKiwifyApiEnv.mockReturnValue(true);
    mockFetch = vi.fn().mockResolvedValue(buildResponse());
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("prefixes bare tokens with Bearer", async () => {
    mockGetKiwifyApiEnv.mockReturnValue(buildEnv("abc123"));

    await getSalesStatistics();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchInit = mockFetch.mock.calls[0]?.[1];
    const headers = fetchInit?.headers instanceof Headers
      ? fetchInit.headers
      : new Headers(fetchInit?.headers);

    expect(headers.get("Authorization")).toBe("Bearer abc123");
  });

  it("uses tokens with existing scheme as-is", async () => {
    mockGetKiwifyApiEnv.mockReturnValue(buildEnv("secret abc123"));

    await getSalesStatistics();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchInit = mockFetch.mock.calls[0]?.[1];
    const headers = fetchInit?.headers instanceof Headers
      ? fetchInit.headers
      : new Headers(fetchInit?.headers);

    expect(headers.get("Authorization")).toBe("secret abc123");
  });
});
