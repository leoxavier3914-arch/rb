import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetEnvForTesting } from "@/lib/env";
import {
  formatKiwifyApiPath,
  getAccessTokenMetadata,
  getKiwifyApiPathPrefix,
  invalidateCachedToken,
} from "@/lib/kiwify/client";

const ORIGINAL_FETCH = global.fetch;

const clearKiwifyEnv = () => {
  delete process.env.KIWIFY_API_BASE_URL;
  delete process.env.KIWIFY_CLIENT_ID;
  delete process.env.KIWIFY_CLIENT_SECRET;
  delete process.env.KIWIFY_ACCOUNT_ID;
  delete process.env.KIWIFY_API_SCOPE;
  delete process.env.KIWIFY_API_AUDIENCE;
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
});


describe("requestAccessToken", () => {
  beforeEach(async () => {
    __resetEnvForTesting();
    clearKiwifyEnv();
    await invalidateCachedToken();
    process.env.KIWIFY_API_BASE_URL = "https://public-api.kiwify.com";
    process.env.KIWIFY_CLIENT_ID = "client";
    process.env.KIWIFY_CLIENT_SECRET = "secret";
    process.env.KIWIFY_ACCOUNT_ID = "account";
  });

  afterEach(async () => {
    global.fetch = ORIGINAL_FETCH;
    __resetEnvForTesting();
    clearKiwifyEnv();
    await invalidateCachedToken();
  });

  it("retries with the configured prefix when the root oauth endpoint is missing", async () => {
    const firstResponse = new Response("Cannot POST /oauth/token", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
    const secondResponse = new Response(
      JSON.stringify({
        access_token: "token",
        token_type: "Bearer",
        expires_in: 3600,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);

    global.fetch = fetchMock as unknown as typeof fetch;

    const metadata = await getAccessTokenMetadata(true);

    expect(metadata.preview).toBe("token");
    expect(metadata.hasToken).toBe(true);
    expect(metadata.expiresAt).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const resolveUrl = (input: unknown) =>
      input instanceof URL ? input.toString() : String(input);

    const firstCallUrl = resolveUrl(fetchMock.mock.calls[0]?.[0]);
    const secondCallUrl = resolveUrl(fetchMock.mock.calls[1]?.[0]);

    expect(firstCallUrl).toBe("https://public-api.kiwify.com/oauth/token");
    expect(secondCallUrl).toBe("https://public-api.kiwify.com/v1/oauth/token");
  });
});
