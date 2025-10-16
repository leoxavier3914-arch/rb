import { describe, expect, it } from "vitest";

import { formatDate } from "./format";

describe("formatDate", () => {
  it("formata datas usando o fuso horário de São Paulo", () => {
    const formatted = formatDate("2025-10-16T21:30:00.000Z");

    expect(formatted).not.toBeNull();
    expect(formatted).toContain("18:30");
  });
});
