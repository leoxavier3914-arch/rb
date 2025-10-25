import { describe, expect, afterEach, beforeEach, it } from "vitest";

import { assertIsAdmin } from "@/lib/auth";

const ORIGINAL_ENV = { ...process.env };

function buildRequest(headers: Record<string, string>) {
  return {
    headers: new Headers(headers),
  } as unknown as Parameters<typeof assertIsAdmin>[0];
}

describe("assertIsAdmin", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("permite requisições em produção quando ALLOWED_ORIGINS não está configurado", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOWED_ORIGINS;

    const request = buildRequest({
      "x-admin-role": "true",
      origin: "https://rb-sigma.vercel.app",
    });

    expect(() => assertIsAdmin(request)).not.toThrow();
  });

  it("aceita origens sem protocolo na variável de ambiente", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "rb-sigma.vercel.app";

    const request = buildRequest({
      "x-admin-role": "true",
      origin: "https://rb-sigma.vercel.app",
    });

    expect(() => assertIsAdmin(request)).not.toThrow();
  });

  it("rejeita origens não listadas", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOWED_ORIGINS = "https://permitido.com";

    const request = buildRequest({
      "x-admin-role": "true",
      origin: "https://negado.com",
    });

    expect(() => assertIsAdmin(request)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
  });
});
