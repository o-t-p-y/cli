// Turn OTPy API failures into one actionable English line (AGENTS.md: terminal
// output is English only). Raw error codes alone ("insufficient_balance") left
// users guessing what to do next.

export const DASH_URL = "https://dash.otpy.ir";

export function apiBaseUrl(): string {
  return (process.env.OTPY_BASE_URL || "https://api.otpy.ir").replace(/\/+$/, "");
}

export interface ApiFailure {
  status: number;
  body: unknown;
}

function errorCode(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return null;
}

export function describeApiError({ status, body }: ApiFailure): string {
  const code = errorCode(body);
  const retryIn =
    body && typeof body === "object" && typeof (body as { retry_in?: unknown }).retry_in === "number"
      ? (body as { retry_in: number }).retry_in
      : null;

  switch (code) {
    case "unauthorized":
      return `The API key was rejected (unauthorized). Check OTPY_API_KEY, or create a new key at ${DASH_URL}/api-keys.`;
    case "insufficient_balance":
      return `Out of free quota and wallet credit (insufficient_balance). Top up at ${DASH_URL}/balance.`;
    case "rate_limited":
      return retryIn !== null
        ? `Too many requests (rate_limited). Try again in ${retryIn}s.`
        : "Too many requests (rate_limited). Wait a minute and try again.";
    case "daily_limit":
      return `Your plan's daily limit is reached (daily_limit). Upgrade at ${DASH_URL}/upgrade or try tomorrow.`;
    case "hourly_limit":
      return "Your plan's hourly limit is reached (hourly_limit). Try again next hour.";
    case "key_limit":
      return `This key hit its own limit (key_limit). Adjust it at ${DASH_URL}/api-keys.`;
    case "bad_phone":
      return "The phone number is invalid (bad_phone). Use the 09xxxxxxxxx format.";
    case "sms_unavailable":
      return "The SMS operator is temporarily unavailable (sms_unavailable); nothing was charged. Try again shortly.";
    case "service_unavailable":
      return "OTPy is restarting (service_unavailable). Try again in a few seconds.";
    case null:
      return `The API returned HTTP ${status} without an OTPy error body${status >= 500 ? " (server or proxy error)" : ""}.`;
    default:
      return `The API returned an error: ${code} (HTTP ${status}).`;
  }
}

/** fetch + JSON that never throws on a non-JSON body (e.g. a proxy's HTML 502). */
export async function requestJson(
  url: string,
  init: RequestInit,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetchFn(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

export function describeNetworkError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return `Timed out reaching ${apiBaseUrl()}. Check your connection and try again.`;
  return `Could not reach ${apiBaseUrl()} (${error instanceof Error ? error.message : String(error)}). Check your connection or proxy.`;
}
