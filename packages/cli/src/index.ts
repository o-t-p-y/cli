#!/usr/bin/env node
import { dirname, join, relative } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import packageMetadata from "../package.json" with { type: "json" };
import { LoginError, deviceLogin, type DeviceKeys } from "./auth.js";
import { detectNextAppRoot, detectNextPagesRoot, detectProject, usesJsSdk, type Framework, type ProjectInfo } from "./detector.js";
import { appendOrUpdateEnvKey, ensureEnvFileIgnored, getExistingEnvKey, validateApiKey } from "./env.js";
import { DASH_URL, apiBaseUrl, describeApiError, describeNetworkError, requestJson } from "./errors.js";
import { SDK_PACKAGE, ensureSdk } from "./install.js";
import { MCP_CLIENTS, MCP_CONFIG_LOCATIONS, isMcpClient, mcpConfigJson, writeCursorConfig, type McpClient } from "./mcp.js";
import { promptSecret, stdinIsInteractive } from "./prompt.js";
import {
  generateExpressTemplates,
  generateGoTemplates,
  generateNextAppTemplates,
  generateNextPagesTemplates,
  generatePhpLaravelTemplates,
  generatePythonFastApiTemplates,
  generatePythonFlaskTemplates,
  generatePythonTemplates,
  generateSvelteKitTemplates,
  phpLaravelRoutesSnippet,
  type GeneratedFile,
} from "./templates.js";
import { printBanner, spinner } from "./ui.js";

const args = process.argv.slice(2);
const META_FLAGS = new Set(["--help", "-h", "--version", "-v"]);
// The first bare word is the command; leading option flags (e.g. `--ai`) mean `init`.
const command = args[0] && (!args[0].startsWith("-") || META_FLAGS.has(args[0])) ? args[0] : "init";
const placeholderApiKey = "otpy_test_key_replace_with_yours";
const API_KEY_PATTERN = /^otpy_[A-Za-z0-9_-]{8,}$/;

/** An expected failure: printed as one ❌ line, exit code 1. */
class CliError extends Error {}

function has(flag: string): boolean {
  return args.includes(flag);
}

function flagValue(flag: string): string | null {
  const i = args.indexOf(flag);
  const v = i === -1 ? undefined : args[i + 1];
  return v && !v.startsWith("--") ? v : null;
}

/** `--mcp` alone means Cursor; `--mcp claude` picks a client. */
function mcpClientFlag(): McpClient | null {
  if (!has("--mcp")) return null;
  const v = flagValue("--mcp");
  if (v === null) return "cursor";
  if (isMcpClient(v)) return v;
  throw new CliError(`Unknown MCP client "${v}". Use one of: ${MCP_CLIENTS.join(", ")}.`);
}

// Terminal output stays English-only; a non-ASCII project name is left out rather than printed.
function asciiOnly(text: string): string | null {
  return /^[\x20-\x7e]+$/.test(text) ? text : null;
}

/** Key for commands that call the API: --api-key, then OTPY_API_KEY in the environment, then the env file. */
function resolveExistingKey(info: ProjectInfo): string | null {
  return flagValue("--api-key") ?? process.env.OTPY_API_KEY ?? getExistingEnvKey(info.envFilePath);
}

async function login(mcp: boolean): Promise<DeviceKeys> {
  try {
    const keys = await deviceLogin({ mcp, openBrowser: !has("--no-browser") && stdinIsInteractive() });
    const project = asciiOnly(keys.projectName);
    console.log(`\n✅ Logged in. New API key ${keys.keyPrefix}... created for project ${project ? `"${project}" ` : ""}(${keys.projectId}).`);
    if (keys.userKey) console.log(`✅ Read-only MCP key created (enable write/billing at ${DASH_URL}/api-keys#mcp).`);
    return keys;
  } catch (error) {
    if (error instanceof LoginError) throw new CliError(error.message);
    throw new CliError(describeNetworkError(error));
  }
}

/** Format + live check for a key the user typed or passed; returns only when it may be saved. */
async function checkProvidedKey(apiKey: string): Promise<void> {
  if (apiKey.startsWith("otpy_uk_")) {
    throw new CliError(`That is an MCP user key (otpy_uk_...). The project needs an API key (otpy_...) from ${DASH_URL}/api-keys.`);
  }
  if (!API_KEY_PATTERN.test(apiKey) && !has("--force")) {
    throw new CliError(`"${apiKey.slice(0, 8)}..." does not look like an OTPy API key (otpy_...). Pass --force to save it anyway.`);
  }
  const s = spinner("🔑 Validating API key...");
  const validation = await validateApiKey(apiKey).finally(() => s.stop());
  if (validation.ok) {
    console.log(`✅ API key validated.`);
  } else if (validation.rejected && !has("--force")) {
    throw new CliError(
      `The API rejected this key (${validation.reason}); it was not saved. Copy the full key, or run "npx @o-t-p-y/cli login" to create one.`,
    );
  } else {
    console.log(`⚠️  Could not verify the key (${validation.reason}). Saving it anyway; run "npx @o-t-p-y/cli usage" later to check it.`);
  }
}

function saveKey(info: ProjectInfo, cwd: string, apiKey: string): void {
  appendOrUpdateEnvKey(info.envFilePath, "OTPY_API_KEY", apiKey);
  console.log(`\n✅ Key saved to ${info.envFilePath}.`);
  if (ensureEnvFileIgnored(cwd, info.envFilePath)) {
    console.log(`✅ Added ${info.envFilePath} to .gitignore.`);
  }
}

function setupMcp(cwd: string, client: McpClient, apiKey: string | null, userKey: string | null): void {
  console.log(`\n🤖 MCP server for ${client}:`);
  if (!apiKey) {
    console.log(`   Skipped: no API key yet. Run "npx @o-t-p-y/cli login --mcp ${client}" first.`);
    return;
  }
  if (client === "cursor") {
    const result = writeCursorConfig(cwd, apiKey, userKey);
    const shown = relative(cwd, result.path);
    if (result.status === "invalid_json") {
      console.log(`   ⚠️  ${shown} is not valid JSON; left untouched. Add this block yourself:`);
      console.log(mcpConfigJson(client, apiKey, userKey));
    } else {
      console.log(`   ✅ Wrote the "otpy" server into ${shown} (other servers kept).`);
      if (ensureEnvFileIgnored(cwd, result.path)) console.log(`   ✅ Added ${shown} to .gitignore (it contains keys).`);
    }
  } else {
    console.log(`   Add this to ${MCP_CONFIG_LOCATIONS[client]}:`);
    console.log(mcpConfigJson(client, apiKey, userKey));
  }
  if (!userKey) {
    console.log(`   Replace OTPY_USER_KEY with an MCP key from ${DASH_URL}/api-keys?create=mcp`);
  }
  console.log(`   Restart ${client} so it picks up the server.`);
}

function wiringHints(framework: Framework, info: ProjectInfo): string[] {
  const src = info.hasSrcDir ? "src/" : "";
  switch (framework) {
    case "express":
    case "node-generic":
      return [`Mount the router: app.use(express.json()); app.use("/auth/otp", otpRouter)  (otpRouter from ./${src}routes/otp)`];
    case "python-fastapi":
      return [`Register the router: from routers import otp; app.include_router(otp.router)`];
    case "php-laravel":
      return [`Laravel 11+: if routes/api.php is not loaded yet, run: php artisan install:api`];
    case "python-flask":
      return [`Register the blueprint: from routes.otp import otp_bp; app.register_blueprint(otp_bp)`];
    case "python-django":
      return [`Call send_otp / verify_otp from otpy_client.py in your views`];
    case "python-generic":
      return [`Call send_otp / verify_otp from otpy_client.py (pip install requests)`];
    default:
      return [];
  }
}

function templatesFor(info: ProjectInfo, cwd: string): GeneratedFile[] {
  switch (info.framework) {
    case "next-app":
      return generateNextAppTemplates(detectNextAppRoot(cwd) === "src/app", info.isTypeScript);
    case "next-pages":
      return generateNextPagesTemplates(detectNextPagesRoot(cwd) === "src/pages", info.isTypeScript);
    case "sveltekit":
      return generateSvelteKitTemplates();
    case "express":
    case "node-generic":
      return generateExpressTemplates(info.hasSrcDir, info.isTypeScript);
    case "python-fastapi":
      return generatePythonFastApiTemplates();
    case "python-flask":
      return generatePythonFlaskTemplates();
    case "python-django":
    case "python-generic":
      // routers/otp.py is a FastAPI router — dead code elsewhere. Django and
      // plain Python projects get the framework-neutral REST client instead.
      return generatePythonTemplates();
    case "go":
      return generateGoTemplates();
    case "php-laravel":
      return generatePhpLaravelTemplates();
    default:
      return [];
  }
}

/** Resolve an API key for init: flag, env file, environment, then browser login or paste. */
async function obtainInitKey(info: ProjectInfo, cwd: string, mcp: boolean): Promise<{ apiKey: string | null; userKey: string | null }> {
  const flagKey = flagValue("--api-key");
  if (flagKey) {
    await checkProvidedKey(flagKey);
    saveKey(info, cwd, flagKey);
    return { apiKey: flagKey, userKey: null };
  }

  const fileKey = getExistingEnvKey(info.envFilePath);
  if (fileKey && fileKey !== placeholderApiKey) {
    console.log(`✅ Using the OTPY_API_KEY already in ${info.envFilePath}.`);
    return { apiKey: fileKey, userKey: null };
  }

  if (process.env.OTPY_API_KEY) {
    console.log(`✅ Using OTPY_API_KEY from the environment (not written to disk).`);
    return { apiKey: process.env.OTPY_API_KEY, userKey: null };
  }

  const interactive = stdinIsInteractive();
  if (has("--login") || (interactive && !has("--paste"))) {
    const typed = has("--login") ? "" : await promptSecret("🔑 Press Enter to log in with your browser, or paste an API key: ");
    if (typed) {
      await checkProvidedKey(typed);
      saveKey(info, cwd, typed);
      return { apiKey: typed, userKey: null };
    }
    const keys = await login(mcp);
    saveKey(info, cwd, keys.apiKey);
    return { apiKey: keys.apiKey, userKey: keys.userKey };
  }

  if (has("--paste") && interactive) {
    const typed = await promptSecret("🔑 API key: ");
    if (typed) {
      await checkProvidedKey(typed);
      saveKey(info, cwd, typed);
      return { apiKey: typed, userKey: null };
    }
  }

  // Non-interactive (CI, AI agent, piped stdin): never block on a prompt.
  console.log(`💡 No API key yet. Get one with "npx @o-t-p-y/cli login" in a terminal,`);
  console.log(`   pass --api-key otpy_..., or set OTPY_API_KEY. Keys: ${DASH_URL}/api-keys`);
  return { apiKey: null, userKey: null };
}

function printManualGuide(framework: Framework): void {
  console.log(
    framework === "php-generic"
      ? `\n🐘 PHP project detected, but no supported framework (Laravel) found.`
      : `\n📝 No supported framework detected; no files were generated.`,
  );
  console.log(`   Manual integration guide: https://otpy.ir/docs`);
  console.log(`\n   Send:`);
  console.log(`   curl -X POST https://api.otpy.ir/v1/otp/send \\`);
  console.log(`     -H "Authorization: Bearer $OTPY_API_KEY" -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"phone":"09123456789"}'`);
  console.log(`\n   Verify:`);
  console.log(`   curl -X POST https://api.otpy.ir/v1/otp/verify \\`);
  console.log(`     -H "Authorization: Bearer $OTPY_API_KEY" -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"phone":"09123456789","code":"123456"}'`);
}

async function runInit() {
  printBanner();
  const cwd = process.cwd();
  const info = detectProject(cwd);
  const mcpClient = mcpClientFlag();

  console.log(`🔍 Scanning project...`);
  console.log(`   Detected framework: ${info.framework}`);
  console.log(`   TypeScript: ${info.isTypeScript ? "yes" : "no"}`);
  console.log(`   Env file: ${info.envFilePath}\n`);

  const { apiKey, userKey } = await obtainInitKey(info, cwd, mcpClient !== null);

  if (info.framework === "php-laravel" && existsSync(join(cwd, "routes/api.php"))) {
    console.log(`\n📝 routes/api.php already exists — append these lines manually:`);
    console.log(phpLaravelRoutesSnippet);
  }

  const filesToGenerate = templatesFor(info, cwd);
  let written = 0;
  if (filesToGenerate.length === 0) {
    printManualGuide(info.framework);
  } else {
    console.log(`\n📦 Generating integration files:`);
    for (const file of filesToGenerate) {
      const fullPath = join(cwd, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      if (!existsSync(fullPath)) {
        writeFileSync(fullPath, file.content, "utf8");
        written++;
        console.log(`   ✅ created ${file.path}`);
      } else {
        console.log(`   ⏭️  skipped (exists): ${file.path}`);
      }
    }
  }

  if (mcpClient) setupMcp(cwd, mcpClient, apiKey, userKey);

  if (has("--ai")) {
    console.log(`\n🤖 AI assistant instructions (Claude Code / Codex / Cursor / Windsurf / Copilot):`);
    if (usesJsSdk(info.framework)) {
      console.log(`   - Library: @o-t-p-y/sdk`);
      console.log(`   - Send: otpy.sendOtp(phone) -> { request_id, ttl_seconds }`);
      console.log(`   - Verify: otpy.verifyOtp(phone, code) -> { verified: true }`);
    } else {
      console.log(`   - REST API: https://api.otpy.ir`);
      console.log(`   - Send: POST /v1/otp/send with body {"phone": "09123456789"}`);
      console.log(`   - Verify: POST /v1/otp/verify with body {"phone": "09123456789", "code": "123456"} → {verified: boolean}`);
    }
  }

  const steps: string[] = [];
  if (!apiKey) steps.push(`Get an API key: npx @o-t-p-y/cli login`);
  if (usesJsSdk(info.framework)) {
    const sdk = ensureSdk({
      cwd,
      interactive: stdinIsInteractive(),
      skip: has("--no-install") || Boolean(process.env.OTPY_CLI_SKIP_INSTALL),
      onStart: (cmd) => console.log(`\n📥 Installing ${SDK_PACKAGE}: ${cmd}`),
    });
    if (sdk.kind === "installed") {
      console.log(`✅ Installed ${SDK_PACKAGE}.`);
    } else if (sdk.kind === "failed") {
      console.log(`⚠️  Could not install ${SDK_PACKAGE}. Run it yourself: ${sdk.command}`);
      steps.push(`Install the SDK: ${sdk.command}`);
    } else if (sdk.kind === "manual") {
      steps.push(`Install the SDK: ${sdk.command}`);
    }
  }
  steps.push(...wiringHints(info.framework, info));
  if (info.framework === "php-laravel") {
    steps.push(`Start the dev server: php artisan serve`);
    steps.push(`Test send: curl -X POST http://localhost:8000/api/auth/otp/send -H "Content-Type: application/json" -d '{"phone":"09123456789"}'`);
  } else if (info.framework === "php-generic") {
    steps.push(`For the full manual integration guide, see https://otpy.ir/docs`);
  } else {
    if (!usesJsSdk(info.framework)) steps.push(`REST API base: https://api.otpy.ir — integrate over HTTP; no npm package needed`);
    steps.push(`Send a test SMS: npx @o-t-p-y/cli test 09123456789`);
  }
  steps.push(`Dashboard & live stats: ${DASH_URL}`);

  // Only claim "complete" when files were actually written.
  console.log(
    written > 0
      ? `\n🎉 Integration complete!`
      : `\n✅ Setup finished${filesToGenerate.length === 0 ? " — no files generated for this stack" : " — all files already existed"}.`,
  );
  console.log(`\nNext steps:`);
  steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
  console.log("");
}

async function runLogin() {
  const cwd = process.cwd();
  const info = detectProject(cwd);
  const mcpClient = mcpClientFlag();
  const keys = await login(mcpClient !== null);
  saveKey(info, cwd, keys.apiKey);
  if (mcpClient) setupMcp(cwd, mcpClient, keys.apiKey, keys.userKey);
  console.log(`\nNext: npx @o-t-p-y/cli init   (generate integration files)`);
}

function requireKey(): string {
  const info = detectProject(process.cwd());
  const apiKey = resolveExistingKey(info);
  if (!apiKey) {
    throw new CliError(`OTPY_API_KEY not found (--api-key, environment, or ${info.envFilePath}). Run "npx @o-t-p-y/cli login" first.`);
  }
  return apiKey;
}

async function callApi(path: string, init: RequestInit, progress: string): Promise<Awaited<ReturnType<typeof requestJson>>> {
  const s = spinner(progress);
  try {
    return await requestJson(`${apiBaseUrl()}${path}`, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new CliError(describeNetworkError(error));
  } finally {
    s.stop();
  }
}

async function runTest() {
  const phone = args[1];
  if (!phone || !/^09\d{9}$/.test(phone)) {
    throw new CliError("A valid mobile number is required. Example: npx @o-t-p-y/cli test 09123456789");
  }
  const apiKey = requireKey();
  const res = await callApi(
    "/v1/otp/send",
    {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    },
    `🚀 Sending test OTP to ${phone}...`,
  );
  if (!res.ok) throw new CliError(`Failed to send SMS. ${describeApiError(res)}`);
  const data = res.body as { request_id?: string; free?: boolean; ttl_seconds?: number };
  console.log(`✅ SMS sent!`);
  console.log(`   Request ID: ${data.request_id}`);
  console.log(`   Billing: ${data.free ? "daily free quota" : "paid credit"}`);
  if (data.ttl_seconds) console.log(`   Code valid for: ${data.ttl_seconds}s`);
}

async function runUsage() {
  const apiKey = requireKey();
  const res = await callApi("/v1/usage", { method: "GET", headers: { authorization: `Bearer ${apiKey}` } }, `📊 Fetching usage...`);
  if (!res.ok) throw new CliError(`Failed to fetch usage. ${describeApiError(res)}`);
  const data = res.body as { free_used_today: number; free_quota_today: number; paid_today: number; daily_limit: number | null };
  console.log(`📊 Today's usage:`);
  console.log(`   Free quota used: ${data.free_used_today} of ${data.free_quota_today}`);
  console.log(`   Paid SMS: ${data.paid_today}`);
  console.log(`   Daily limit: ${data.daily_limit ? data.daily_limit : "unlimited"}`);
}

const HELP = `
Usage: npx @o-t-p-y/cli <command> [options]

Commands:
  init                 Detect your stack, log in, and generate integration files (default)
  login                Log in with your browser and save a new API key to the env file
  test <phone>         Send a real test OTP SMS (09xxxxxxxxx)
  usage                Show today's usage and quota

Options:
  --api-key <key>      Use this API key instead of logging in
  --paste              init: paste a key instead of logging in with the browser
  --login              init: log in with the browser even when stdin is not a terminal
  --no-browser         Print the login link instead of opening a browser (servers, SSH)
  --mcp [client]       Also set up the MCP server: ${MCP_CLIENTS.join(" | ")} (default: cursor)
  --ai                 init: print instructions for AI coding agents
  --no-install         init: do not install @o-t-p-y/sdk (only print the command)
  --force              Save a key even if it fails the format or live check
  -h, --help           Show this help
  -v, --version        Show the CLI version

Environment:
  OTPY_API_KEY         API key used when no --api-key is given
  OTPY_BASE_URL        API base URL (default: https://api.otpy.ir)
  OTPY_CLI_SKIP_INSTALL  init: set to skip installing @o-t-p-y/sdk (same as --no-install)
`;

async function main(): Promise<void> {
  switch (command) {
    case "--version":
    case "-v":
      console.log(packageMetadata.version);
      return;
    case "--help":
    case "-h":
    case "help":
      console.log(HELP);
      return;
    case "init":
      return runInit();
    case "login":
      return runLogin();
    case "test":
      return runTest();
    case "usage":
      return runUsage();
    default:
      throw new CliError(`Unknown command: ${command}\nRun npx @o-t-p-y/cli --help for usage.`);
  }
}

main().catch((error: unknown) => {
  console.log(
    error instanceof CliError
      ? `❌ ${error.message}`
      : `❌ Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
