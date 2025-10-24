import { Buffer } from "node:buffer";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetEnvForTesting } from "@/lib/env";
import {
  formatKiwifyApiPath,
  getAccessTokenMetadata,
  getKiwifyApiPathPrefix,
  invalidateCachedToken,
  kiwifyFetch,
} from "@/lib/kiwify/client";

const ORIGINAL_FETCH = global.fetch;

const encodeBase64Url = (input: string) =>
  Buffer.from(input).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const createJwt = (payload: Record<string, unknown>) => {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

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

  it("includes the partner id header when configured", async () => {
    process.env.KIWIFY_PARTNER_ID = "partner-123";

    await kiwifyFetch("products", { skipAuth: true });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers((init?.headers ?? undefined) as HeadersInit | undefined);

    expect(headers.get("x-kiwify-partner-id")).toBe("partner-123");
  });

  it("respects caller overrides for the partner id header", async () => {
    process.env.KIWIFY_PARTNER_ID = "partner-123";

    await kiwifyFetch("products", {
      skipAuth: true,
      headers: {
        "x-kiwify-partner-id": "custom-partner",
      },
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers((init?.headers ?? undefined) as HeadersInit | undefined);

    expect(headers.get("x-kiwify-partner-id")).toBe("custom-partner");
  });

  it("sends the kiwify account id header when authenticated", async () => {
    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async (input) => {
        const requestUrl =
          input instanceof URL
            ? input.href
            : typeof input === "string"
              ? input
              : input.url;

        expect(requestUrl).toBe("https://public-api.kiwify.com/oauth/token");

        return new Response(
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
        );
      })
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

  it("uses documented fallbacks to resolve the account identifier", async () => {
    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            access_token: "token-abc",
            token_type: "Bearer",
            expires_in: 3600,
            account: { id: "acc-from-account" },
            user: { account_id: "acc-from-user" },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-account");
        expect(headers.get("authorization")).toBe("Bearer token-abc");

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-account");

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

  it("resolves the account identifier from the JWT payload when not present elsewhere", async () => {
    const jwt = createJwt({
      account_id: "acc-from-jwt",
    });

    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            access_token: jwt,
            token_type: "Bearer",
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-jwt");
        expect(headers.get("authorization")).toBe(`Bearer ${jwt}`);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-jwt");

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

  it("prefers the account id from the token response when both sources provide one", async () => {
    const jwt = createJwt({
      account_id: "acc-from-jwt",
    });

    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            access_token: jwt,
            token_type: "Bearer",
            expires_in: 3600,
            account_id: "acc-from-response",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-response");
        expect(headers.get("authorization")).toBe(`Bearer ${jwt}`);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-response");

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

  it("ignores JWT account slug when the response provides an identifier", async () => {
    const jwt = createJwt({
      account: { slug: "acc-slug" },
    });

    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async () =>
        new Response(
          JSON.stringify({
            access_token: jwt,
            token_type: "Bearer",
            expires_in: 3600,
            account_id: "acc-from-response",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-response");
        expect(headers.get("authorization")).toBe(`Bearer ${jwt}`);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-from-response");

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

  it("retries without the account id header when Kiwify rejects it", async () => {
    const createMismatchResponse = () =>
      new Response(
        JSON.stringify({
          error: "auth_error",
          message: "Invalid token: acces token account_id mismatch with x-kiwify-account-id header",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );

    const fetchMock = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementationOnce(async (input) => {
        const requestUrl =
          input instanceof URL
            ? input.href
            : typeof input === "string"
              ? input
              : input.url;

        expect(requestUrl).toBe("https://public-api.kiwify.com/oauth/token");

        return new Response(
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
        );
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-42");
        return createMismatchResponse();
      })
      .mockImplementationOnce(async (input) => {
        const requestUrl =
          input instanceof URL
            ? input.href
            : typeof input === "string"
              ? input
              : input.url;

        expect(requestUrl).toBe("https://public-api.kiwify.com/oauth/token");

        return new Response(
          JSON.stringify({
            access_token: "token-456",
            token_type: "Bearer",
            expires_in: 3600,
            account_id: "acc-42",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.get("x-kiwify-account-id")).toBe("acc-42");
        return createMismatchResponse();
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.has("x-kiwify-account-id")).toBe(false);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
      .mockImplementationOnce(async (_input, init) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        expect(headers.has("x-kiwify-account-id")).toBe(false);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(kiwifyFetch("products")).resolves.toEqual({ ok: true });
    await expect(kiwifyFetch("products")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(6);
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

describe("requestAccessToken", () => {
  beforeEach(async () => {
    __resetEnvForTesting();
    clearKiwifyEnv();
    await invalidateCachedToken();
    process.env.KIWIFY_API_BASE_URL = "https://public-api.kiwify.com";
    process.env.KIWIFY_API_CLIENT_ID = "client";
    process.env.KIWIFY_API_CLIENT_SECRET = "secret";
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
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const resolveUrl = (input: unknown) =>
      input instanceof URL ? input.toString() : String(input);

    const firstCallUrl = resolveUrl(fetchMock.mock.calls[0]?.[0]);
    const secondCallUrl = resolveUrl(fetchMock.mock.calls[1]?.[0]);

    expect(firstCallUrl).toBe("https://public-api.kiwify.com/oauth/token");
    expect(secondCallUrl).toBe("https://public-api.kiwify.com/v1/oauth/token");
  });
});
