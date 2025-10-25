import { describe, expect, it, vi, afterEach } from "vitest";

const locale = "pt-BR";

describe("format helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("formats currency values", async () => {
    const { formatCurrency } = await import("@/lib/format");

    expect(formatCurrency(12345)).toBe(
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      }).format(123.45),
    );
  });

  it("memoizes currency formatters per currency", async () => {
    const numberFormatSpy = vi.spyOn(Intl, "NumberFormat");
    const { formatCurrency } = await import("@/lib/format");

    formatCurrency(100, "USD");
    formatCurrency(200, "USD");
    formatCurrency(300, "EUR");

    expect(numberFormatSpy).toHaveBeenCalledTimes(2);
  });

  it("memoizes percentage formatters based on options", async () => {
    const numberFormatSpy = vi.spyOn(Intl, "NumberFormat");
    const { formatPercentage } = await import("@/lib/format");

    formatPercentage(0.12);
    formatPercentage(0.34);
    formatPercentage(0.56, { maximumFractionDigits: 2 });
    formatPercentage(0.78, { maximumFractionDigits: 2 });

    expect(numberFormatSpy).toHaveBeenCalledTimes(2);
  });

  it("respects custom percentage options", async () => {
    const { formatPercentage } = await import("@/lib/format");

    expect(formatPercentage(0.156, { maximumFractionDigits: 2 })).toBe(
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(0.156),
    );
  });
});
