import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetEnvForTesting } from "@/lib/env";
import {
  formatKiwifyApiPath,
  getKiwifyApiPathPrefix,
  invalidateCachedToken,
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
  beforeEach(async () => {
    __resetEnvForTesting();
    clearKiwifyEnv();
    await invalidateCachedToken();
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

  afterEach(async () => {
    global.fetch = ORIGINAL_FETCH;
    __resetEnvForTesting();
    clearKiwifyEnv();
    await invalidateCachedToken();
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

  it("sends the kiwify account id header when authenticated", async () => {
    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            access_token: "token-123",
            token_type: "Bearer",
            expires_in: 3600,
            account_id: "acc-42",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-42");
        expect(headers.get("authorization")).toBe("Bearer token-123");

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-42");

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    await kiwifyFetch("products");
    await kiwifyFetch("products");

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes cached account metadata when the token is reissued", async () => {
    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            access_token: "token-123",
            token_type: "Bearer",
            expires_in: 1,
            account_id: "acc-initial",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-initial");
        return new Response(null, { status: 401 });
      })
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            access_token: "token-456",
            token_type: "Bearer",
            expires_in: 3600,
            account_id: "acc-updated",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-updated");

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-updated");

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    await kiwifyFetch("products");
    await kiwifyFetch("products");

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
