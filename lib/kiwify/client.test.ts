import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetEnvForTesting } from "@/lib/env";
import {
  formatKiwifyApiPath,
  getKiwifyApiPathPrefix,
  kiwifyFetch,
} from "@/lib/kiwify/client";

const ORIGINAL_FETCH = global.fetch;

const clearKiwifyEnv = () => {
  delete process.env.KIWIFY_API_BASE_URL;
  delete process.env.KIWIFY_API_CLIENT_ID;
  delete process.env.KIWIFY_API_CLIENT_SECRET;
  delete process.env.KIWIFY_API_SCOPE;
  delete process.env.KIWIFY_API_AUDIENCE;
  delete process.env.KIWIFY_API_PATH_PREFIX;
  delete process.env.KIWIFY_PARTNER_ID;
};

describe("kiwify api path helpers", () => {
  beforeEach(() => {
    __resetEnvForTesting();
    clearKiwifyEnv();
  });

  afterEach(() => {
    __resetEnvForTesting();
    clearKiwifyEnv();
  });

  it("falls back to the default /v1 prefix when env is not configured", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      expect(getKiwifyApiPathPrefix()).toBe("/v1");
      expect(formatKiwifyApiPath("products")).toBe("/v1/products");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("normalizes a custom prefix from environment variables", () => {
    process.env.KIWIFY_API_BASE_URL = "https://public-api.kiwify.com";
    process.env.KIWIFY_API_CLIENT_ID = "client";
    process.env.KIWIFY_API_CLIENT_SECRET = "secret";
    process.env.KIWIFY_API_PATH_PREFIX = " sandbox/v2/ ";

    expect(getKiwifyApiPathPrefix()).toBe("/sandbox/v2");
    expect(formatKiwifyApiPath("products/:id/participants")).toBe(
      "/sandbox/v2/products/:id/participants",
    );
  });

  it("treats a single slash prefix as no versioning", () => {
    process.env.KIWIFY_API_BASE_URL = "https://public-api.kiwify.com";
    process.env.KIWIFY_API_CLIENT_ID = "client";
    process.env.KIWIFY_API_CLIENT_SECRET = "secret";
    process.env.KIWIFY_API_PATH_PREFIX = "/";

    expect(getKiwifyApiPathPrefix()).toBe("");
    expect(formatKiwifyApiPath("products")).toBe("/products");
  });
});

describe("kiwifyFetch", () => {
  beforeEach(() => {
    __resetEnvForTesting();
    clearKiwifyEnv();
    process.env.KIWIFY_API_BASE_URL = "https://public-api.kiwify.com";
    process.env.KIWIFY_API_CLIENT_ID = "client";
    process.env.KIWIFY_API_CLIENT_SECRET = "secret";
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    __resetEnvForTesting();
    clearKiwifyEnv();
  });

  it("prefixes relative resource paths with the configured version", async () => {
    await kiwifyFetch("products", { skipAuth: true });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls[0];
    const input = call[0];
    const requestUrl =
      input instanceof URL ? input.href : typeof input === "string" ? input : input.url;

    expect(requestUrl).toBe("https://public-api.kiwify.com/v1/products");
  });

  it("respects absolute paths provided by the caller", async () => {
    await kiwifyFetch("/v2/products", { skipAuth: true });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const call = fetchMock.mock.calls[0];
    const input = call[0];
    const requestUrl =
      input instanceof URL ? input.href : typeof input === "string" ? input : input.url;

    expect(requestUrl).toBe("https://public-api.kiwify.com/v2/products");
  });
});
