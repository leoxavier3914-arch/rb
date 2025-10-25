import { describe, expect, it, vi } from "vitest";

import { fetchAllSalesByWindow, listSales } from "@/lib/kiwify/resources";

const recordedCalls: Array<{
  start_date?: string;
  end_date?: string;
  page_number?: number;
  page_size?: number;
}> = [];

vi.mock("@/lib/kiwify/http", () => {
  return {
    kiwifyFetch: vi.fn(async (path: string) => {
      const url = new URL(path, "https://public-api.kiwify.com");
      const params = Object.fromEntries(url.searchParams.entries());
      const pageNumber = Number(params.page_number ?? 1);
      const pageSize = Number(params.page_size ?? 0) || undefined;

      recordedCalls.push({
        start_date: params.start_date,
        end_date: params.end_date,
        page_number: pageNumber,
        page_size: pageSize,
      });

      const startDate = params.start_date;

      let payload;
      if (startDate === "2024-01-01" && pageNumber === 1) {
        payload = {
          data: [{ id: "sale-1" }],
          meta: { has_more: true },
        };
      } else if (startDate === "2024-01-01" && pageNumber === 2) {
        payload = {
          data: [{ id: "sale-2" }],
          meta: { has_more: false },
        };
      } else {
        payload = {
          data: [{ id: `sale-${startDate}-p${pageNumber}` }],
          meta: { has_more: false },
        };
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  };
});

describe("fetchAllSalesByWindow", () => {
  it("divide o período em blocos de até 90 dias com paginação", async () => {
    recordedCalls.length = 0;

    const result = await fetchAllSalesByWindow("2024-01-01", "2024-04-15", 50);

    expect(result.sales).toHaveLength(3);
    expect(result.summary.totalIntervals).toBe(2);
    expect(result.summary.totalPages).toBe(3);

    const firstInterval = recordedCalls.filter((call) => call.start_date === "2024-01-01");
    const secondInterval = recordedCalls.filter((call) => call.start_date === "2024-03-31");

    expect(firstInterval).toHaveLength(2);
    expect(secondInterval).toHaveLength(1);

    expect(firstInterval[0]).toMatchObject({
      start_date: "2024-01-01",
      end_date: "2024-03-31",
      page_number: 1,
      page_size: 50,
    });

    expect(firstInterval[1]).toMatchObject({
      start_date: "2024-01-01",
      end_date: "2024-03-31",
      page_number: 2,
      page_size: 50,
    });

    expect(secondInterval[0]).toMatchObject({
      start_date: "2024-03-31",
      end_date: "2024-04-16",
      page_number: 1,
      page_size: 50,
    });
  });

  it("ajusta janela diária quando endDate é omitido", async () => {
    recordedCalls.length = 0;

    await listSales({ startDate: "2025-10-25" });

    expect(recordedCalls).toHaveLength(1);
    expect(recordedCalls[0]).toMatchObject({
      start_date: "2025-10-25",
      end_date: "2025-10-26",
      page_number: 1,
    });
  });
});
