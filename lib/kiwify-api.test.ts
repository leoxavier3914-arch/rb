import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasKiwifyApiEnv, mockGetKiwifyApiEnv } = vi.hoisted(() => ({
  mockHasKiwifyApiEnv: vi.fn(),
  mockGetKiwifyApiEnv: vi.fn(),
}));

vi.mock("./env", () => ({
  hasKiwifyApiEnv: mockHasKiwifyApiEnv,
  getKiwifyApiEnv: mockGetKiwifyApiEnv,
}));

import { getSalesStatistics, getKiwifyProducts } from "./kiwify-api";

describe("kiwifyRequest authorization header", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = (token: string) => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: token,
    KIWIFY_API_ACCOUNT_ID: "account-123",
  });

  const buildStatsResponse = () =>
    new Response(
      JSON.stringify({
        total_sales: 0,
        total_net_amount: 0,
        total_gross_amount: 0,
        total_kiwify_commission: 0,
        total_affiliate_commission: 0,
        currency: "BRL",
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
    mockFetch = vi.fn().mockResolvedValue(buildStatsResponse());
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

describe("kiwifyRequest account id handling", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
  });

  const buildStatsResponse = () =>
    new Response(
      JSON.stringify({
        total_sales: 0,
        total_net_amount: 0,
        total_gross_amount: 0,
        total_kiwify_commission: 0,
        total_affiliate_commission: 0,
        currency: "BRL",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  const buildProductsResponse = () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  beforeEach(() => {
    mockHasKiwifyApiEnv.mockReset();
    mockGetKiwifyApiEnv.mockReset();

    mockHasKiwifyApiEnv.mockReturnValue(true);
    mockGetKiwifyApiEnv.mockReturnValue(buildEnv());

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("omits account_id for public v1 endpoints", async () => {
    mockFetch.mockResolvedValueOnce(buildStatsResponse());

    await getSalesStatistics();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0]?.[0];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toContain("v1/stats");
    expect(url.searchParams.has("account_id")).toBe(false);
  });

  it("retains account_id for legacy api/v1 endpoints", async () => {
    mockFetch.mockResolvedValueOnce(buildProductsResponse());

    await getKiwifyProducts();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0]?.[0];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toContain("api/v1/products");
    expect(url.searchParams.get("account_id")).toBe("account-123");
  });
});

describe("getSalesStatistics data mapping", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
  });

  const buildStatsResponse = () =>
    new Response(
      JSON.stringify({
        total_sales: 3,
        total_net_amount: 450,
        total_gross_amount: 600,
        total_kiwify_commission: 90,
        total_affiliate_commission: 60,
        currency: "BRL",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  const buildSalesResponse = () =>
    new Response(
      JSON.stringify([
        {
          id: "sale-1",
          paid_at: "2024-01-01T12:00:00Z",
          gross_amount: 200,
          net_amount: 150,
          currency: "BRL",
        },
        {
          id: "sale-2",
          paid_at: "2024-01-01T15:00:00Z",
          gross_amount: 100,
          net_amount: 80,
          currency: "BRL",
        },
        {
          id: "sale-3",
          paid_at: "2024-01-02T10:00:00Z",
          gross_amount: 300,
          net_amount: 220,
          currency: "BRL",
        },
      ]),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  beforeEach(() => {
    mockHasKiwifyApiEnv.mockReset();
    mockGetKiwifyApiEnv.mockReset();

    mockHasKiwifyApiEnv.mockReturnValue(true);
    mockGetKiwifyApiEnv.mockReturnValue(buildEnv());
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps totals from /v1/stats", async () => {
    mockFetch.mockResolvedValueOnce(buildStatsResponse());

    const result = await getSalesStatistics();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0]?.[0];
    expect(String(requestUrl)).toContain("v1/stats");

    expect(result.totals).toEqual(
      expect.objectContaining({
        totalOrders: 3,
        netAmount: 450,
        grossAmount: 600,
        kiwifyCommission: 90,
        affiliateCommission: 60,
        currency: "BRL",
      }),
    );
    expect(result.totals.averageTicket).toBeCloseTo(150);
    expect(result.breakdown).toEqual([]);
  });

  it("defaults start and end dates when filters are missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-15T00:00:00Z"));

    mockFetch.mockResolvedValueOnce(buildStatsResponse());

    try {
      await getSalesStatistics();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const requestUrl = mockFetch.mock.calls[0]?.[0];
      const url = new URL(String(requestUrl));

      expect(url.searchParams.get("start_date")).toBe("2024-01-17");
      expect(url.searchParams.get("end_date")).toBe("2024-02-15");
    } finally {
      vi.useRealTimers();
    }
  });

  it("builds a timeline from /v1/sales when grouping by day", async () => {
    mockFetch.mockResolvedValueOnce(buildStatsResponse()).mockResolvedValueOnce(buildSalesResponse());

    const result = await getSalesStatistics({
      groupBy: "day",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain("v1/stats");
    expect(String(mockFetch.mock.calls[1]?.[0])).toContain("v1/sales");

    expect(result.breakdown).toEqual([
      {
        label: "01/01/2024",
        grossAmount: 300,
        netAmount: 230,
        orders: 2,
        currency: "BRL",
      },
      {
        label: "02/01/2024",
        grossAmount: 300,
        netAmount: 220,
        orders: 1,
        currency: "BRL",
      },
    ]);
  });
});
