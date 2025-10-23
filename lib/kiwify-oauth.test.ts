import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetKiwifyApiEnv } = vi.hoisted(() => ({
  mockGetKiwifyApiEnv: vi.fn(),
}));

vi.mock("./env", () => ({
  getKiwifyApiEnv: mockGetKiwifyApiEnv,
}));

import {
  __resetKiwifyOAuthForTesting,
  getKiwifyAccessToken,
  invalidateKiwifyAccessToken,
} from "./kiwify-oauth";

describe("kiwify oauth token manager", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  const buildEnv = () => ({
    KIWIFY_API_BASE_URL: "https://public-api.kiwify.com/",
    KIWIFY_API_ACCOUNT_ID: "account-123",
    KIWIFY_API_CLIENT_ID: "client-id",
    KIWIFY_API_CLIENT_SECRET: "client-secret",
  });

  const buildTokenResponse = (token: string, expiresIn = 120) =>
    new Response(
      JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: expiresIn }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  beforeEach(() => {
    mockGetKiwifyApiEnv.mockReset();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    mockGetKiwifyApiEnv.mockReturnValue(buildEnv());
    __resetKiwifyOAuthForTesting();
  });

  afterEach(() => {
    __resetKiwifyOAuthForTesting();
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("requests and caches tokens", async () => {
    fetchMock.mockResolvedValue(buildTokenResponse("abc123", 300));

    const token = await getKiwifyAccessToken();
    const body = fetchMock.mock.calls[0]?.[1];
    const params = new URLSearchParams(String((body as RequestInit | undefined)?.body ?? ""));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(params.get("grant_type")).toBe("client_credentials");
    expect(params.get("client_id")).toBe("client-id");
    expect(params.get("client_secret")).toBe("client-secret");
    expect(token.authorization).toBe("Bearer abc123");

    const cached = await getKiwifyAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cached).toBe(token);
  });

  it("normalizes bearer schemes from the token response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "lower", token_type: "bearer", expires_in: 120 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const token = await getKiwifyAccessToken();
    expect(token.authorization).toBe("Bearer lower");
  });

  it("refreshes tokens when they approach expiry", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(buildTokenResponse("first", 120))
      .mockResolvedValueOnce(buildTokenResponse("second", 120));

    const first = await getKiwifyAccessToken();
    expect(first.authorization).toBe("Bearer first");

    vi.advanceTimersByTime(56_000);

    const second = await getKiwifyAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.authorization).toBe("Bearer second");
  });

  it("invalidates tokens manually", async () => {
    fetchMock
      .mockResolvedValueOnce(buildTokenResponse("before", 300))
      .mockResolvedValueOnce(buildTokenResponse("after", 300));

    const first = await getKiwifyAccessToken();
    expect(first.authorization).toBe("Bearer before");

    invalidateKiwifyAccessToken();

    const second = await getKiwifyAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.authorization).toBe("Bearer after");
  });

  it("surfaces error messages from failed requests", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error_description: "invalid_client" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(getKiwifyAccessToken()).rejects.toThrow("invalid_client");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
