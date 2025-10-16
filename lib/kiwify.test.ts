import { describe, expect, it } from "vitest";

import { normalizeDate } from "./kiwify";

describe("normalizeDate", () => {
  it("converts naive datetime strings using America/Sao_Paulo offset", () => {
    const payload = { occurred_at: "2024-10-18 17:40:00" };

    expect(normalizeDate(payload, ["occurred_at"])).toBe("2024-10-18T20:40:00.000Z");
  });

  it("keeps strings with explicit timezone", () => {
    const payload = { occurred_at: "2024-10-18T17:40:00-03:00" };

    expect(normalizeDate(payload, ["occurred_at"])).toBe("2024-10-18T20:40:00.000Z");
  });

  it("supports numeric timestamps in seconds", () => {
    const payload = { occurred_at: 1729276800 };

    expect(normalizeDate(payload, ["occurred_at"])).toBe("2024-10-18T18:40:00.000Z");
  });
});
