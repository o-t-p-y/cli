import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LoginError, deviceLogin } from "../src/auth.js";
import { getExistingEnvKey } from "../src/env.js";
import { describeApiError, requestJson } from "../src/errors.js";
import { mcpConfigJson, writeCursorConfig } from "../src/mcp.js";

const requireFromTest = createRequire(import.meta.url);

type Reply = { status: number; body: unknown };

function jsonFetch(script: Array<Reply | ((url: string, init?: RequestInit) => Reply)>) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const next = script.shift();
    if (!next) throw new Error("unexpected fetch");
    const reply = typeof next === "function" ? next(url, init) : next;
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof globalThis.fetch;
  return { fetchFn, calls };
}

const started = {
  status: 200,
  body: {
    device_code: "secret-device-code",
    user_code: "BCDF-GHJK",
    verification_uri: "https://dash.otpy.ir/cli",
    verification_uri_complete: "https://dash.otpy.ir/cli?code=BCDF-GHJK",
    expires_in: 600,
    interval: 5,
  },
};

describe("device login", () => {
  it("polls until approval, honoring slow_down, and returns the keys", async () => {
    const { fetchFn, calls } = jsonFetch([
      started,
      { status: 400, body: { error: "authorization_pending" } },
      { status: 400, body: { error: "slow_down" } },
      {
        status: 200,
        body: { api_key: "otpy_new_key_123", key_prefix: "otpy_new_key", project_id: "p1", project_name: "shop", user_key: "otpy_uk_x" },
      },
    ]);
    const sleeps: number[] = [];
    const opened: string[] = [];
    const lines: string[] = [];
    let clock = 0;

    const keys = await deviceLogin({
      mcp: true,
      openBrowser: true,
      fetchFn,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
      now: () => clock,
      open: (url) => (opened.push(url), true),
      log: (l) => lines.push(l),
    });

    expect(keys).toEqual({ apiKey: "otpy_new_key_123", keyPrefix: "otpy_new_key", projectId: "p1", projectName: "shop", userKey: "otpy_uk_x" });
    expect(calls[0]!.body).toMatchObject({ mcp: true });
    expect(calls.slice(1).every((c) => (c.body as { device_code: string }).device_code === "secret-device-code")).toBe(true);
    expect(sleeps).toEqual([5000, 5000, 10000]);
    expect(opened).toEqual(["https://dash.otpy.ir/cli?code=BCDF-GHJK"]);
    expect(lines.join("\n")).toContain("BCDF-GHJK");
    // The secret device code is never printed.
    expect(lines.join("\n")).not.toContain("secret-device-code");
  });

  it.each([
    ["access_denied", /denied/],
    ["invalid_grant", /already used/],
  ])("stops with a clear error on %s", async (code, message) => {
    const { fetchFn } = jsonFetch([started, { status: 400, body: { error: code } }]);
    await expect(
      deviceLogin({ mcp: false, openBrowser: false, fetchFn, sleep: async () => {}, log: () => {} }),
    ).rejects.toThrow(message);
  });

  it("gives up when the code expires", async () => {
    let clock = 0;
    const { fetchFn } = jsonFetch([
      { status: 200, body: { ...started.body, expires_in: 10 } },
      { status: 400, body: { error: "authorization_pending" } },
      { status: 400, body: { error: "expired_token" } },
    ]);
    await expect(
      deviceLogin({ mcp: false, openBrowser: false, fetchFn, sleep: async (ms) => void (clock += ms), now: () => clock, log: () => {} }),
    ).rejects.toBeInstanceOf(LoginError);
  });

  it("reports a start failure through the error map", async () => {
    const { fetchFn } = jsonFetch([{ status: 429, body: { error: "rate_limited", retry_in: 30 } }]);
    await expect(deviceLogin({ mcp: false, openBrowser: false, fetchFn, log: () => {} })).rejects.toThrow("Try again in 30s");
  });
});

describe("api error map", () => {
  it("turns codes into next steps", () => {
    expect(describeApiError({ status: 402, body: { error: "insufficient_balance" } })).toContain("https://dash.otpy.ir/balance");
    expect(describeApiError({ status: 429, body: { error: "rate_limited", retry_in: 12 } })).toContain("12s");
    expect(describeApiError({ status: 502, body: null })).toContain("HTTP 502");
  });

  it("does not throw on a non-JSON body (proxy HTML error page)", async () => {
    const fetchFn = (async () => new Response("<html>Bad Gateway</html>", { status: 502 })) as typeof globalThis.fetch;
    await expect(requestJson("http://x", {}, fetchFn)).resolves.toEqual({ ok: false, status: 502, body: null });
  });
});

describe("env and mcp files", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "otpy-cli-login-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reads quoted, exported, and commented env values", () => {
    const env = join(dir, ".env");
    writeFileSync(env, `export OTPY_API_KEY="otpy_quoted_123"\n`);
    expect(getExistingEnvKey(env)).toBe("otpy_quoted_123");
    writeFileSync(env, `OTPY_API_KEY='otpy_single_123'\n`);
    expect(getExistingEnvKey(env)).toBe("otpy_single_123");
    writeFileSync(env, `OTPY_API_KEY=otpy_plain_123 # prod key\n`);
    expect(getExistingEnvKey(env)).toBe("otpy_plain_123");
    writeFileSync(env, `OTPY_API_KEY=\n`);
    expect(getExistingEnvKey(env)).toBeNull();
  });

  it("merges the otpy server into an existing .cursor/mcp.json without touching other servers", () => {
    mkdirSync(join(dir, ".cursor"));
    writeFileSync(join(dir, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { github: { command: "gh-mcp" } }, other: 1 }));
    expect(writeCursorConfig(dir, "otpy_k", "otpy_uk_k").status).toBe("written");
    const written = JSON.parse(readFileSync(join(dir, ".cursor", "mcp.json"), "utf8"));
    expect(written.other).toBe(1);
    expect(written.mcpServers.github).toEqual({ command: "gh-mcp" });
    expect(written.mcpServers.otpy.env).toEqual({ OTPY_API_KEY: "otpy_k", OTPY_USER_KEY: "otpy_uk_k" });
  });

  it("refuses to overwrite a .cursor/mcp.json that is not valid JSON", () => {
    mkdirSync(join(dir, ".cursor"));
    writeFileSync(join(dir, ".cursor", "mcp.json"), "{ broken");
    expect(writeCursorConfig(dir, "otpy_k", null).status).toBe("invalid_json");
    expect(readFileSync(join(dir, ".cursor", "mcp.json"), "utf8")).toBe("{ broken");
  });

  it("uses the Kilo config shape for kilo", () => {
    expect(JSON.parse(mcpConfigJson("kilo", "otpy_k", null))).toEqual({
      mcp: { otpy: { type: "local", command: ["npx", "-y", "@o-t-p-y/mcp"], environment: { OTPY_API_KEY: "otpy_k", OTPY_USER_KEY: "otpy_uk_..." } } },
    });
  });
});

// End-to-end through the real binary against a local fake API (async spawn, so the
// in-process HTTP server can answer while the CLI runs).
describe("cli process against a fake API", () => {
  let server: Server;
  let baseUrl: string;
  let handler: (req: IncomingMessage, res: ServerResponse, body: string) => void;
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "otpy-cli-proc-"));
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => handler(req, res, body));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    await new Promise((r) => server.close(r));
    rmSync(dir, { recursive: true, force: true });
  });

  function run(args: string[], env: Record<string, string> = {}): Promise<{ code: number | null; stdout: string }> {
    const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ["--import", requireFromTest.resolve("tsx"), cliPath, ...args], {
        cwd: dir,
        env: { ...process.env, OTPY_API_KEY: "", OTPY_BASE_URL: baseUrl, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      child.stdout.on("data", (c) => (stdout += c));
      child.on("close", (code) => resolve({ code, stdout }));
    });
  }

  function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  }

  it("refuses to save a key the API rejects and exits 1", async () => {
    handler = (_req, res) => json(res, 401, { error: "unauthorized" });
    writeFileSync(join(dir, ".env"), "PORT=1\n");
    const result = await run(["init", "--api-key", "otpy_wrong_key_123"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("rejected");
    expect(readFileSync(join(dir, ".env"), "utf8")).not.toContain("otpy_wrong_key_123");
  });

  it("rejects an MCP user key passed as the API key", async () => {
    handler = (_req, res) => json(res, 200, {});
    const result = await run(["init", "--api-key", "otpy_uk_abcdefgh"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("MCP user key");
  });

  it("test exits 1 with an actionable message when out of balance, using OTPY_BASE_URL", async () => {
    handler = (req, res) => {
      expect(req.url).toBe("/v1/otp/send");
      json(res, 402, { error: "insufficient_balance" });
    };
    const result = await run(["test", "09123456789"], { OTPY_API_KEY: "otpy_env_key_123" });
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("https://dash.otpy.ir/balance");
  });

  it("login (non-interactive) prints the link, waits for approval, and saves the key", async () => {
    let polls = 0;
    handler = (req, res, body) => {
      if (req.url === "/v1/cli/device") return json(res, 200, { ...started.body, interval: 1 });
      if (req.url === "/v1/cli/device/token") {
        expect(JSON.parse(body)).toEqual({ device_code: "secret-device-code" });
        polls++;
        if (polls < 2) return json(res, 400, { error: "authorization_pending" });
        return json(res, 200, { api_key: "otpy_from_login_123", key_prefix: "otpy_from_l", project_id: "p1", project_name: "فروشگاه", user_key: null });
      }
      json(res, 404, { error: "not_found" });
    };
    const result = await run(["login", "--no-browser"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("https://dash.otpy.ir/cli?code=BCDF-GHJK");
    expect(result.stdout).not.toMatch(/[؀-ۿ]/);
    expect(getExistingEnvKey(join(dir, ".env"))).toBe("otpy_from_login_123");
  }, 15_000);

  it("login --mcp cursor writes .cursor/mcp.json with both keys", async () => {
    handler = (req, res) => {
      if (req.url === "/v1/cli/device") return json(res, 200, { ...started.body, interval: 1 });
      return json(res, 200, { api_key: "otpy_from_login_123", key_prefix: "otpy_from_l", project_id: "p1", project_name: "shop", user_key: "otpy_uk_from_login" });
    };
    const result = await run(["login", "--mcp", "cursor", "--no-browser"]);
    expect(result.code).toBe(0);
    const config = JSON.parse(readFileSync(join(dir, ".cursor", "mcp.json"), "utf8"));
    expect(config.mcpServers.otpy.env).toEqual({ OTPY_API_KEY: "otpy_from_login_123", OTPY_USER_KEY: "otpy_uk_from_login" });
  }, 15_000);

  it("init without a key and without a TTY never prompts and says how to get one", async () => {
    handler = (_req, res) => json(res, 500, {});
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { express: "^4" } }));
    const result = await run(["init"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("npx @o-t-p-y/cli login");
    expect(result.stdout).toContain("app.use(\"/auth/otp\"");
  }, 15_000);
});
