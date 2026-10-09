// Browser login for the CLI: OAuth-style device authorization (RFC 8628) against
// the OTPy API. The CLI never sees the user's phone or session -- it shows a short
// code, the user approves it in dash.otpy.ir, and the first poll after approval
// returns a freshly created project API key (and optionally an MCP user key).

import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { apiBaseUrl, describeApiError, requestJson } from "./errors.js";

export interface DeviceStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface DeviceKeys {
  apiKey: string;
  keyPrefix: string;
  projectId: string;
  projectName: string;
  userKey: string | null;
}

export class LoginError extends Error {}

export interface LoginOptions {
  mcp: boolean;
  openBrowser: boolean;
  fetchFn?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  open?: (url: string) => boolean;
  log?: (line: string) => void;
  now?: () => number;
}

export function clientName(): string {
  const name = hostname().replace(/[^\w.-]+/g, "-").slice(0, 48) || "otpy-cli";
  return name;
}

/** Best-effort browser open; returns false when no opener could be spawned. */
export function openUrl(url: string): boolean {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args as string[], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export async function deviceLogin(options: LoginOptions): Promise<DeviceKeys> {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const log = options.log ?? ((line) => console.log(line));
  const now = options.now ?? Date.now;
  const base = apiBaseUrl();

  const started = await requestJson(
    `${base}/v1/cli/device`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: clientName(), mcp: options.mcp }),
      signal: AbortSignal.timeout(10_000),
    },
    fetchFn,
  );
  if (!started.ok) throw new LoginError(`Could not start login: ${describeApiError(started)}`);
  const device = started.body as DeviceStart;

  log(`\n🔐 Log in to OTPy`);
  log(`   1. Open: ${device.verification_uri_complete}`);
  log(`   2. Check the code matches:  ${device.user_code}`);
  log(`   3. Pick a project and approve.`);
  if (options.openBrowser) {
    const opened = (options.open ?? openUrl)(device.verification_uri_complete);
    log(opened ? `   (Opening your browser...)` : `   (Could not open a browser; open the link above manually.)`);
  }
  log(`\n⏳ Waiting for approval (expires in ${Math.round(device.expires_in / 60)} min, Ctrl+C to cancel)...`);

  const deadline = now() + device.expires_in * 1000;
  let intervalMs = Math.max(device.interval, 1) * 1000;

  while (now() < deadline) {
    await sleep(intervalMs);
    let polled: Awaited<ReturnType<typeof requestJson>>;
    try {
      polled = await requestJson(
        `${base}/v1/cli/device/token`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ device_code: device.device_code }),
          signal: AbortSignal.timeout(10_000),
        },
        fetchFn,
      );
    } catch {
      // A dropped poll is not fatal; keep waiting until the code expires.
      continue;
    }

    if (polled.ok) {
      const body = polled.body as {
        api_key: string;
        key_prefix: string;
        project_id: string;
        project_name: string;
        user_key: string | null;
      };
      return {
        apiKey: body.api_key,
        keyPrefix: body.key_prefix,
        projectId: body.project_id,
        projectName: body.project_name,
        userKey: body.user_key ?? null,
      };
    }

    const code = (polled.body as { error?: string } | null)?.error;
    if (code === "authorization_pending") continue;
    if (code === "slow_down") {
      intervalMs += 5_000;
      continue;
    }
    if (code === "access_denied") throw new LoginError("Login was denied in the browser. No key was created.");
    if (code === "expired_token") break;
    if (code === "invalid_grant") throw new LoginError("This login code was already used or is unknown. Run the command again.");
    throw new LoginError(`Login failed: ${describeApiError(polled)}`);
  }
  throw new LoginError("The login code expired before it was approved. Run the command again.");
}
