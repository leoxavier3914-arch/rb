import { describe, expect, it } from "vitest";

import { summarizeSales } from "./summary";

describe("summarizeSales", () => {
  it("aggregates totals only for approved sales and counts statuses", () => {
    const sales = [
      {
        status: "paid",
        amount: 1000,
        net_amount: 800,
        fees: 200,
        buyer: { name: "Alice", email: "alice@example.com" },
        product: { id: "1", name: "Produto A" },
      },
      {
        status: "pending",
        amount: 500,
        buyer: { name: "Bob", email: "bob@example.com" },
      },
      {
        status: "paid",
        amount: 700,
        commissions: { kiwify: 100, gateway: 50 },
        buyer: { name: "Carol", email: "carol@example.com" },
      },
      {
        status: "refunded",
        amount: 400,
      },
      {
        payment_status: "chargeback",
        amount: 250,
      },
    ];

    const result = summarizeSales({ sales });

    expect(result.totals).toEqual({
      gross_amount_cents: 1700,
      net_amount_cents: 1350,
      kiwify_commission_cents: 350,
    });

    expect(result.counts).toEqual({
      approved: 2,
      pending: 1,
      refunded: 1,
      refused: 0,
      chargeback: 1,
    });

    expect(result.filteredCount).toBe(5);
  });

  it("respects status and query filters", () => {
    const sales = [
      {
        status: "paid",
        amount: 1000,
        buyer: { name: "Alice", email: "alice@example.com" },
      },
      {
        status: "paid",
        amount: 800,
        buyer: { name: "Bob", email: "bob@example.com" },
      },
      {
        status: "pending",
        amount: 600,
        buyer: { name: "Bia", email: "bia@example.com" },
      },
    ];

    const filtered = summarizeSales({ sales, status: "paid", query: "bob@example.com" });

    expect(filtered.filteredCount).toBe(1);
    expect(filtered.totals.gross_amount_cents).toBe(800);
    expect(filtered.counts.approved).toBe(1);
    expect(filtered.counts.pending).toBe(0);
  });
});
