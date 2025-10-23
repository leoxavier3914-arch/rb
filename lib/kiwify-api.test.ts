import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockHasKiwifyApiEnv, mockGetKiwifyApiEnv } = vi.hoisted(() => ({
  mockHasKiwifyApiEnv: vi.fn(),
  mockGetKiwifyApiEnv: vi.fn(),
}));

vi.mock("./env", () => ({
  hasKiwifyApiEnv: mockHasKiwifyApiEnv,
  getKiwifyApiEnv: mockGetKiwifyApiEnv,
}));

import {
  getSalesStatistics,
  getKiwifyProducts,
  getKiwifySale,
  getKiwifySales,
  getKiwifySubscriptions,
  getPixelEvents,
  refundKiwifySale,
} from "./kiwify-api";

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
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const buildSubscriptionsResponse = () =>
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
    mockFetch.mockResolvedValueOnce(buildSubscriptionsResponse());

    await getKiwifySubscriptions();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0]?.[0];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toContain("api/v1/subscriptions");
    expect(url.searchParams.get("account_id")).toBe("account-123");
  });

  it("uses the products endpoint without account_id query param", async () => {
    mockFetch.mockResolvedValueOnce(buildProductsResponse());

    await getKiwifyProducts();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0]?.[0];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toContain("v1/products");
    expect(url.searchParams.has("account_id")).toBe(false);
  });
});

describe("getSalesStatistics JSON:API handling", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
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

  it("reads totals and timeline from JSON:API payloads", async () => {
    const statsPayload = {
      data: {
        type: "stats",
        id: "stats-1",
        attributes: {
          summary: {
            data: {
              type: "stats-summary",
              id: "summary-1",
              attributes: {
                gross_amount: 200,
                net_amount: 150,
                total_orders: 3,
                currency: "USD",
              },
            },
          },
        },
      },
      included: [
        {
          type: "stats-summary",
          id: "summary-1",
          attributes: {
            kiwify_commission: 25,
            affiliate_commission: 15,
          },
        },
      ],
    };

    const salesPayload = {
      data: [
        {
          type: "sale",
          id: "sale-1",
          attributes: {
            paid_at: "2024-01-01T12:00:00Z",
            gross_amount_cents: 6000,
            net_amount_cents: 5000,
            quantity: 1,
            currency: "USD",
          },
        },
        {
          type: "sale",
          id: "sale-2",
          attributes: {
            paid_at: "2024-01-02T12:00:00Z",
            gross_amount_cents: 14000,
            net_amount_cents: 10000,
            quantity: 2,
            currency: "USD",
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(statsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(salesPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getSalesStatistics({ groupBy: "day" });

    expect(result.totals.grossAmount).toBeCloseTo(200);
    expect(result.totals.netAmount).toBeCloseTo(150);
    expect(result.totals.totalOrders).toBe(3);
    expect(result.totals.currency).toBe("USD");
    expect(result.totals.kiwifyCommission).toBeCloseTo(25);
    expect(result.totals.affiliateCommission).toBeCloseTo(15);

    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0]).toMatchObject({
      orders: 1,
      currency: "USD",
    });
    expect(result.breakdown[1]).toMatchObject({
      orders: 2,
      currency: "USD",
    });
  });
});

describe("getKiwifyProducts price fallbacks", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
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

  it("handles JSON:API style payloads with attributes", async () => {
    const productsPayload = {
      data: [
        {
          id: "prod-jsonapi",
          attributes: {
            name: "Produto JSON API",
            default_price: {
              price_cents: 12345,
              currency: "USD",
            },
            image_url: "https://example.com/image.jpg",
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(productsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getKiwifyProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.name).toBe("Produto JSON API");
    expect(result.products[0]?.price).toBeCloseTo(123.45, 2);
    expect(result.products[0]?.currency).toBe("USD");
    expect(result.products[0]?.imageUrl).toBe("https://example.com/image.jpg");
  });

  it("extracts price from JSON:API relationships with included resources", async () => {
    const productsPayload = {
      data: [
        {
          type: "product",
          id: "prod-jsonapi-rel",
          attributes: {
            name: "Produto JSON API Relationship",
          },
          relationships: {
            default_price: {
              data: { type: "prices", id: "price-jsonapi" },
            },
            default_offer: {
              data: { type: "offers", id: "offer-jsonapi" },
            },
          },
        },
      ],
      included: [
        {
          type: "prices",
          id: "price-jsonapi",
          attributes: {
            price_cents: 54321,
            currency: "BRL",
          },
        },
        {
          type: "offers",
          id: "offer-jsonapi",
          attributes: {
            price_cents: 54321,
            currency: "BRL",
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(productsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getKiwifyProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.name).toBe("Produto JSON API Relationship");
    expect(result.products[0]?.price).toBeCloseTo(543.21, 2);
    expect(result.products[0]?.currency).toBe("BRL");
  });

  it("reads price and currency from the official product payload shape", async () => {
    const productsPayload = {
      data: [
        {
          id: "prod-official",
          name: "Produto Oficial",
          price: {
            price: "147.00",
            price_cents: 14700,
            currency: "BRL",
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(productsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getKiwifyProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.price).toBeCloseTo(147, 2);
    expect(result.products[0]?.currency).toBe("BRL");
  });

  it("uses default_price fields when top-level price is null", async () => {
    const productsPayload = {
      data: [
        {
          id: "prod-default-price",
          name: "Produto com Default Price",
          price: null,
          default_price: {
            price: "199.90",
            price_cents: 19990,
            amount: "199.90",
            amount_cents: 19990,
            currency: "BRL",
          },
          offers: [
            {
              price: 1,
              currency: "USD",
            },
          ],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(productsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getKiwifyProducts();

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.price).toBeCloseTo(199.9, 2);
    expect(result.products[0]?.currency).toBe("BRL");
  });

  it("derives price information from nested offers when top-level price is missing", async () => {
    const productsPayload = {
      data: [
        {
          id: "prod-default",
          name: "Produto Default",
          price: null,
          default_offer: {
            installments: [
              { price_cents: 6789 },
              { price: 70 },
            ],
          },
        },
        {
          id: "prod-offer",
          name: "Produto Oferta",
          price: undefined,
          offers: [
            { price_cents: 4321 },
            {
              installments: [
                { price: 55 },
              ],
            },
          ],
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(productsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getKiwifyProducts();

    expect(result.products).toHaveLength(2);
    expect(result.products[0]?.price).toBeCloseTo(67.89, 2);
    expect(result.products[1]?.price).toBeCloseTo(43.21, 2);
  });

  it("walks nested offer structures to locate deeply nested pricing fields", async () => {
    const productsPayload = {
      data: [
        {
          id: "prod-nested-default",
          name: "Produto Default Aninhado",
          price: null,
          default_offer: {
            data: [
              {
                price: {
                  price_cents: 12900,
                },
              },
            ],
          },
        },
        {
          id: "prod-plan",
          name: "Produto Plano",
          price: undefined,
          offers: [
            {
              plan: {
                amount_cents: 9900,
              },
            },
          ],
        },
        {
          id: "prod-deep-installment",
          name: "Produto Parcelado",
          price: null,
          offers: {
            data: [
              {
                payment_plans: [
                  {
                    installments: [
                      {
                        pricing: {
                          price_cents: 4500,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(productsPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getKiwifyProducts();

    expect(result.products).toHaveLength(3);
    expect(result.products[0]?.price).toBeCloseTo(129, 2);
    expect(result.products[1]?.price).toBeCloseTo(99, 2);
    expect(result.products[2]?.price).toBeCloseTo(45, 2);
  });
});

describe("getKiwifySubscriptions JSON:API handling", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
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

  it("maps subscriptions with relationship data from included resources", async () => {
    const payload = {
      data: [
        {
          type: "subscription",
          id: "sub-1",
          attributes: {
            status: "active",
            created_at: "2024-02-01T00:00:00Z",
          },
          relationships: {
            plan: { data: { type: "plan", id: "plan-1" } },
            customer: { data: { type: "customer", id: "customer-1" } },
            pricing: { data: { type: "price", id: "price-1" } },
          },
        },
      ],
      included: [
        {
          type: "plan",
          id: "plan-1",
          attributes: {
            name: "Plano Pro",
            product_name: "Curso Avançado",
            price_cents: 9900,
            currency: "USD",
          },
        },
        {
          type: "customer",
          id: "customer-1",
          attributes: {
            name: "Alice",
            email: "alice@example.com",
          },
        },
        {
          type: "price",
          id: "price-1",
          attributes: {
            amount_cents: 9900,
            currency: "USD",
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getKiwifySubscriptions();

    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions[0]).toMatchObject({
      id: "sub-1",
      status: "active",
      planName: "Plano Pro",
      productName: "Curso Avançado",
      customerName: "Alice",
      customerEmail: "alice@example.com",
      amount: 99,
      currency: "USD",
    });
  });
});

describe("getPixelEvents JSON:API handling", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
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

  it("extracts pixel metrics from JSON:API payloads", async () => {
    const payload = {
      data: [
        {
          type: "pixel-event",
          id: "evt-1",
          attributes: {
            event_name: "Purchase",
            amount_cents: 1234,
            currency: "USD",
            occurred_at: "2024-03-01T12:30:00Z",
            traffic: {
              utm_source: "google",
              utm_medium: "cpc",
              utm_campaign: "camp-1",
            },
          },
        },
      ],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getPixelEvents();

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      id: "evt-1",
      eventName: "Purchase",
      amount: 12.34,
      currency: "USD",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "camp-1",
    });
    expect(result.totalAmount).toBeCloseTo(12.34);
    expect(result.currency).toBe("USD");
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

describe("getKiwifySales", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
  });

  const buildListResponse = () =>
    new Response(
      JSON.stringify({
        pagination: {
          page_number: 2,
          page_size: 50,
          count: 120,
          total_pages: 3,
          start_date: "2024-01-01",
          end_date: "2024-01-31",
          updated_at_start_date: "2024-01-05T00:00:00Z",
          updated_at_end_date: "2024-01-30T23:59:59Z",
        },
        data: [
          {
            id: "order-1",
            order_id: "order-1",
            reference: "REF-1",
            status: "paid",
            payment_method: "credit_card",
            installments: 3,
            gross_amount: 200,
            net_amount: 150,
            kiwify_commission: 20,
            affiliate_commission: 10,
            currency: "BRL",
            approved_date: "2024-01-10T10:00:00Z",
            created_at: "2024-01-09T08:00:00Z",
            updated_at: "2024-01-10T10:05:00Z",
            customer: {
              id: "cust-1",
              name: "Cliente Um",
              email: "cliente@example.com",
              cpf: "12345678900",
              mobile: "+551199999999",
            },
            product: {
              id: "prod-1",
              name: "Produto A",
            },
          },
        ],
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
    mockGetKiwifyApiEnv.mockReturnValue(buildEnv());
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("applies filters to the query string and maps the payload", async () => {
    mockFetch.mockResolvedValueOnce(buildListResponse());

    const result = await getKiwifySales({
      status: "paid",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      updatedAtStartDate: "2024-01-05T00:00:00Z",
      updatedAtEndDate: "2024-01-30T23:59:59Z",
      productId: "prod-1",
      affiliateId: "aff-1",
      page: 2,
      perPage: 50,
      viewFullSaleDetails: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0]?.[0];
    const url = new URL(String(requestUrl));

    expect(url.pathname).toContain("v1/sales");
    expect(url.searchParams.get("status")).toBe("paid");
    expect(url.searchParams.get("start_date")).toBe("2024-01-01");
    expect(url.searchParams.get("end_date")).toBe("2024-01-31");
    expect(url.searchParams.get("updated_at_start_date")).toBe(
      "2024-01-05T00:00:00Z",
    );
    expect(url.searchParams.get("updated_at_end_date")).toBe(
      "2024-01-30T23:59:59Z",
    );
    expect(url.searchParams.get("product_id")).toBe("prod-1");
    expect(url.searchParams.get("affiliate_id")).toBe("aff-1");
    expect(url.searchParams.get("page_number")).toBe("2");
    expect(url.searchParams.get("page_size")).toBe("50");
    expect(url.searchParams.get("view_full_sale_details")).toBe("true");

    expect(result.error).toBeUndefined();
    expect(result.sales).toHaveLength(1);

    const sale = result.sales[0];
    expect(sale).toEqual(
      expect.objectContaining({
        id: "order-1",
        orderId: "order-1",
        reference: "REF-1",
        status: "paid",
        paymentMethod: "credit_card",
        installments: 3,
        grossAmount: 200,
        netAmount: 150,
        currency: "BRL",
        approvedAt: "2024-01-10T10:00:00Z",
      }),
    );
    expect(sale.customer).toEqual(
      expect.objectContaining({
        id: "cust-1",
        name: "Cliente Um",
        email: "cliente@example.com",
        document: "12345678900",
        phone: "+551199999999",
      }),
    );
    expect(sale.product).toEqual(
      expect.objectContaining({ id: "prod-1", name: "Produto A" }),
    );

    expect(result.pagination).toEqual(
      expect.objectContaining({
        pageNumber: 2,
        pageSize: 50,
        totalCount: 120,
        totalPages: 3,
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      }),
    );
  });
});

describe("getKiwifySale", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
  });

  const buildDetailResponse = () =>
    new Response(
      JSON.stringify({
        id: "order-1",
        order_id: "order-1",
        reference: "REF-1",
        status: "paid",
        payment_method: "credit_card",
        installments: 6,
        gross_amount: 200,
        net_amount: 150,
        total_amount: 210,
        kiwify_commission: 20,
        affiliate_commission: 10,
        currency: "BRL",
        approved_date: "2024-01-10T10:00:00Z",
        created_at: "2024-01-09T08:00:00Z",
        updated_at: "2024-01-10T10:05:00Z",
        boleto_url: "https://boleto.example.com",
        pix_key: "123456789",
        pix_qr_code: "qr-code-data",
        card_last_digits: "4242",
        card_brand: "visa",
        customer: {
          id: "cust-1",
          name: "Cliente Um",
          email: "cliente@example.com",
          cpf: "12345678900",
          mobile: "+551199999999",
        },
        product: {
          id: "prod-1",
          name: "Produto A",
        },
        affiliate: {
          id: "aff-1",
          name: "Afiliado",
          email: "afiliado@example.com",
        },
        shipping: {
          id: "ship-1",
          name: "Entrega",
          price: 10,
        },
        revenue_partners: [
          {
            account_id: "partner-1",
            legal_name: "Coprodutor",
            document_id: "99999999999",
            percentage: 30,
            amount: 5,
            role: "coproducer",
          },
        ],
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
    mockGetKiwifyApiEnv.mockReturnValue(buildEnv());
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("maps the sale detail payload", async () => {
    mockFetch.mockResolvedValueOnce(buildDetailResponse());

    const result = await getKiwifySale("order-1");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0]?.[0];
    expect(String(requestUrl)).toContain("v1/sales/order-1");

    expect(result.error).toBeUndefined();
    expect(result.sale).not.toBeNull();

    const sale = result.sale!;
    expect(sale).toEqual(
      expect.objectContaining({
        id: "order-1",
        orderId: "order-1",
        reference: "REF-1",
        status: "paid",
        paymentMethod: "credit_card",
        installments: 6,
        grossAmount: 200,
        netAmount: 150,
        totalAmount: 210,
        boletoUrl: "https://boleto.example.com",
        pixKey: "123456789",
        pixQrCode: "qr-code-data",
        cardLastDigits: "4242",
        cardBrand: "visa",
      }),
    );
    expect(sale.affiliate).toEqual(
      expect.objectContaining({ id: "aff-1", email: "afiliado@example.com" }),
    );
    expect(sale.shipping).toEqual(
      expect.objectContaining({ id: "ship-1", name: "Entrega", price: 10 }),
    );
    expect(sale.revenuePartners).toEqual([
      expect.objectContaining({
        accountId: "partner-1",
        legalName: "Coprodutor",
        documentId: "99999999999",
        percentage: 30,
        amount: 5,
        role: "coproducer",
      }),
    ]);
  });
});

describe("refundKiwifySale", () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://api.example.com/",
    KIWIFY_API_TOKEN: "abc123",
    KIWIFY_API_ACCOUNT_ID: "account-123",
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

  it("sends a POST request and returns the refund status", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ refunded: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await refundKiwifySale("order-1", { pixKey: "123" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = mockFetch.mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain("v1/sales/order-1/refund");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeDefined();

    const parsedBody = JSON.parse(String(init?.body));
    expect(parsedBody).toEqual({ pixKey: "123" });

    expect(result.refunded).toBe(true);
    expect(result.status).toBe(200);
    expect(result.error).toBeUndefined();
  });
});
