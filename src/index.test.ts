import { describe, expect, it, vi } from "vitest";
import { OtpyClient, OtpyError } from "./index.js";

function mockFetch(status: number, payload: unknown) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("OtpyClient", () => {
  it("requires an api key", () => {
    expect(() => new OtpyClient({ apiKey: "" })).toThrow(OtpyError);
  });

  it("rejects malformed phone numbers before any network call", async () => {
    const fetchFn = mockFetch(200, {});
    const client = new OtpyClient({ apiKey: "k", fetch: fetchFn });
    await expect(client.sendOtp("12345")).rejects.toMatchObject({ code: "bad_phone" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sends bearer auth and returns the send result", async () => {
    const fetchFn = mockFetch(200, { request_id: "r1", ttl_seconds: 300, free: true });
    const client = new OtpyClient({ apiKey: "secret", fetch: fetchFn });
    const res = await client.sendOtp("09120000000");
    expect(res).toEqual({ request_id: "r1", ttl_seconds: 300, free: true });
    const [, init] = fetchFn.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ authorization: "Bearer secret" });
  });

  it("verify returns the boolean verdict", async () => {
    const fetchFn = mockFetch(200, { verified: true });
    const client = new OtpyClient({ apiKey: "k", fetch: fetchFn });
    await expect(client.verifyOtp("09120000000", "123456")).resolves.toEqual({ verified: true });
  });

  it("maps non-2xx responses to OtpyError with the server code", async () => {
    const fetchFn = mockFetch(429, { error: "rate_limited" });
    const client = new OtpyClient({ apiKey: "k", fetch: fetchFn });
    await expect(client.sendOtp("09120000000")).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    });
  });
});
