// otpy SDK — zero dependencies, works in Node 18+ and browsers.
// All amounts are tomans; the public API surface mirrors api.otpy.ir/v1.

export interface OtpyClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export interface OtpSendResult {
  request_id: string;
  ttl_seconds: number;
  free: boolean;
}

export interface OtpVerifyResult {
  verified: boolean;
}

export interface OtpUsage {
  free_used_today: number;
  free_quota_today: number;
  paid_today: number;
  daily_limit: number | null;
}

export class OtpyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? `otpy: ${code} (${status})`);
    this.name = "OtpyError";
    this.status = status;
    this.code = code;
  }
}

const PHONE_RE = /^09\d{9}$/;

export class OtpyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: OtpyClientOptions) {
    if (!options.apiKey) throw new OtpyError(0, "missing_api_key");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.otpy.ir").replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async sendOtp(phone: string): Promise<OtpSendResult> {
    if (!PHONE_RE.test(phone)) throw new OtpyError(0, "bad_phone");
    return this.request<OtpSendResult>("POST", "/v1/otp/send", { phone });
  }

  async verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
    if (!PHONE_RE.test(phone)) throw new OtpyError(0, "bad_phone");
    if (!code) throw new OtpyError(0, "bad_otp");
    return this.request<OtpVerifyResult>("POST", "/v1/otp/verify", { phone, code });
  }

  async usage(): Promise<OtpUsage> {
    return this.request<OtpUsage>("GET", "/v1/usage");
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        let code = "http_error";
        try {
          const err = (await res.json()) as { error?: string };
          if (err.error) code = err.error;
        } catch {
          /* non-JSON error body */
        }
        throw new OtpyError(res.status, code);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof OtpyError) throw err;
      if (err instanceof Error && err.name === "AbortError") throw new OtpyError(0, "timeout");
      throw new OtpyError(0, "network_error");
    } finally {
      clearTimeout(timer);
    }
  }
}
