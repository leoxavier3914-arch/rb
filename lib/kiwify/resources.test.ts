import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/kiwify/client", () => ({
  kiwifyFetch: vi.fn(),
}));

const { listAllSales, listSales } = await import("@/lib/kiwify/resources");
const { kiwifyFetch } = await import("@/lib/kiwify/client");

describe("kiwify/resources", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forwards pagination parameters to listSales", async () => {
    vi.mocked(kiwifyFetch).mockResolvedValue({ data: [] });

    await listSales({
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      page: 2,
      perPage: 50,
      status: "approved",
      path: "custom/sales",
    });

    expect(kiwifyFetch).toHaveBeenCalledTimes(1);
    expect(kiwifyFetch).toHaveBeenCalledWith("custom/sales", {
      searchParams: {
        page_number: 2,
        page_size: 50,
        status: "approved",
        start_date: "2024-01-01",
        end_date: "2024-03-31",
      },
    });
  });

  it("caps page size to 100 when listing sales", async () => {
    vi.mocked(kiwifyFetch).mockResolvedValue({ data: [] });

    await listSales({
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      pageSize: 150,
    });

    expect(kiwifyFetch).toHaveBeenCalledWith("sales", {
      searchParams: {
        page_number: 1,
        page_size: 100,
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      },
    });
  });

  it("forwards productId when listing sales", async () => {
    vi.mocked(kiwifyFetch).mockResolvedValue({ data: [] });

    await listSales({
      startDate: "2024-02-01",
      endDate: "2024-02-29",
      productId: "123",
    });

    expect(kiwifyFetch).toHaveBeenCalledWith("sales", {
      searchParams: {
        page_number: 1,
        page_size: 100,
        start_date: "2024-02-01",
        end_date: "2024-02-29",
        product_id: "123",
      },
    });
  });

  it("fetches all sales in 90-day intervals and aggregates results", async () => {
    const responses = [
      {
        data: [{ id: "first" }],
        meta: { has_more: true },
      },
      {
        data: [{ id: "second" }],
        meta: { has_more: false },
      },
      {
        data: [{ id: "third" }],
        meta: { has_more: false },
      },
    ];

    vi.mocked(kiwifyFetch).mockImplementation(async () => {
      const next = responses.shift();
      if (!next) throw new Error("Unexpected call");
      return next;
    });

    const result = await listAllSales({
      startDate: "2024-01-01",
      endDate: "2024-04-15",
      perPage: 1,
    });

    expect(kiwifyFetch).toHaveBeenCalledTimes(3);

    const [firstCall, secondCall, thirdCall] = vi.mocked(kiwifyFetch).mock.calls;

    expect(firstCall[1]).toEqual({
      searchParams: {
        page_number: 1,
        page_size: 1,
        start_date: "2024-01-01",
        end_date: "2024-03-30",
      },
    });

    expect(secondCall[1]).toEqual({
      searchParams: {
        page_number: 2,
        page_size: 1,
        start_date: "2024-01-01",
        end_date: "2024-03-30",
      },
    });

    expect(thirdCall[1]).toEqual({
      searchParams: {
        page_number: 1,
        page_size: 1,
        start_date: "2024-03-31",
        end_date: "2024-04-15",
      },
    });

    expect(result.summary).toEqual({
      range: {
        startDate: "2024-01-01",
        endDate: "2024-04-15",
      },
      totalIntervals: 2,
      totalPages: 3,
      totalSales: 3,
    });

    expect(result.sales).toEqual([
      { id: "first" },
      { id: "second" },
      { id: "third" },
    ]);

    expect(result.requests).toHaveLength(2);
    expect(result.requests[0].pages).toHaveLength(2);
    expect(result.requests[1].pages).toHaveLength(1);
  });

  it("caps page size to 100 for all-time sales aggregation", async () => {
    vi.mocked(kiwifyFetch).mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });

    await listAllSales({
      startDate: "2024-01-01",
      endDate: "2024-01-15",
      perPage: 150,
    });

    expect(kiwifyFetch).toHaveBeenCalledTimes(1);
    expect(kiwifyFetch).toHaveBeenCalledWith("sales", {
      searchParams: {
        page_number: 1,
        page_size: 100,
        start_date: "2024-01-01",
        end_date: "2024-01-15",
      },
    });
  });
});
