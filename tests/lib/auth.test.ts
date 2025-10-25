import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertIsAdmin } from "@/lib/auth";

const ORIGINAL_ENV = { ...process.env };

function buildRequest(headers: Record<string, string>) {
  return new Request("https://example.com", { headers });
}

describe("assertIsAdmin", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("permite quando ALLOWED_ORIGINS está vazio", async () => {
    delete process.env.ALLOWED_ORIGINS;

    const request = buildRequest({
      "x-admin-role": "true",
      origin: "https://rb.localhost",
    });

    await expect(assertIsAdmin(request)).resolves.toBeUndefined();
  });

  it("aceita hostname sozinho", async () => {
    process.env.ALLOWED_ORIGINS = "rb.vercel.app";

    const request = buildRequest({
      "x-admin-role": "true",
      origin: "https://rb.vercel.app",
    });

    await expect(assertIsAdmin(request)).resolves.toBeUndefined();
  });

  it("aceita wildcard de subdomínio", async () => {
    process.env.ALLOWED_ORIGINS = "*.vercel.app";

    const request = buildRequest({
      "x-admin-role": "true",
      origin: "https://preview-rb.vercel.app",
    });

    await expect(assertIsAdmin(request)).resolves.toBeUndefined();
  });

  it("usa host como fallback quando origin está ausente", async () => {
    process.env.ALLOWED_ORIGINS = "localhost:3000";

    const request = buildRequest({
      "x-admin-role": "true",
      host: "localhost:3000",
    });

    await expect(assertIsAdmin(request)).resolves.toBeUndefined();
  });

  it("rejeita origem desconhecida", async () => {
    process.env.ALLOWED_ORIGINS = "rb.vercel.app";

    const request = buildRequest({
      "x-admin-role": "true",
      origin: "https://malicioso.com",
    });

    await expect(assertIsAdmin(request)).rejects.toMatchObject({
      status: 403,
    });
  });
});
