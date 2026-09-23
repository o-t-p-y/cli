import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectNextPagesRoot, detectProject } from "../src/detector.js";
import { appendOrUpdateEnvKey, ensureEnvFileIgnored, getExistingEnvKey, validateApiKey } from "../src/env.js";
import {
  generateExpressTemplates,
  generateGoTemplates,
  generateNextAppTemplates,
  generateNextPagesTemplates,
  generatePhpLaravelTemplates,
  generatePythonFastApiTemplates,
  generatePythonTemplates,
  generateSvelteKitTemplates,
} from "../src/templates.js";
import { BANNER_TEXT, BRAILLE_FRAMES, spinner } from "../src/ui.js";

const requireFromTest = createRequire(import.meta.url);

// Shared spawn helper: runs the CLI from source with a dead OTPY_BASE_URL so
// key validation fails fast offline. One definition, used by every describe
// below (describe-scoped duplicates were drift-prone).
function runCli(args: string[], dir: string): ReturnType<typeof spawnSync> {
  const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
  return spawnSync(
    process.execPath,
    ["--import", requireFromTest.resolve("tsx"), cliPath, ...args],
    { cwd: dir, encoding: "utf8", env: { ...process.env, OTPY_BASE_URL: "http://127.0.0.1:1" } },
  );
}

function runCliInit(dir: string): ReturnType<typeof spawnSync> {
  return runCli(["init", "--api-key", "otpy_test_key_123"], dir);
}

describe("otpy cli detector & env", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "otpy-cli-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects Next.js pages router (no app dir) and tsconfig", () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
    );
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");

    const info = detectProject(tempDir);
    expect(info.framework).toBe("next-pages");
    expect(info.isTypeScript).toBe(true);
  });

  it("selects an existing .env for a Next project when .env.local is absent", () => {
    // Given: a Next project with only an existing .env file
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
    );
    const envPath = join(tempDir, ".env");
    writeFileSync(envPath, "PORT=3000\n");

    // When: the CLI detects the project
    const info = detectProject(tempDir);

    // Then: it preserves the existing environment file choice
    expect(info.envFilePath).toBe(envPath);
  });

  it("detects Python FastAPI and Go projects", () => {
    writeFileSync(join(tempDir, "requirements.txt"), "fastapi\nuvicorn\n");
    const pyInfo = detectProject(tempDir);
    expect(pyInfo.framework).toBe("python-fastapi");

    rmSync(join(tempDir, "requirements.txt"));

    writeFileSync(join(tempDir, "go.mod"), "module example.com/app\n");
    const goInfo = detectProject(tempDir);
    expect(goInfo.framework).toBe("go");
  });

  it("prefers non-JS markers over a bare package.json (hybrid stacks)", () => {
    // Given: a repo with a tooling package.json but no JS framework deps
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "hybrid" }));
    writeFileSync(join(tempDir, "requirements.txt"), "fastapi\nuvicorn\n");

    // When: the CLI detects the project
    // Then: the non-JS marker wins — the project must not get JS files
    expect(detectProject(tempDir).framework).toBe("python-fastapi");

    rmSync(join(tempDir, "requirements.txt"));
    writeFileSync(join(tempDir, "go.mod"), "module example.com/app\n");
    expect(detectProject(tempDir).framework).toBe("go");
  });

  it("keeps an explicit JS dependency winning over non-JS markers", () => {
    // A declared framework dependency is intent; a bare package.json is not.
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ dependencies: { express: "^4.19.2" } }),
    );
    writeFileSync(join(tempDir, "requirements.txt"), "fastapi\n");
    expect(detectProject(tempDir).framework).toBe("express");
  });

  it("appends and updates OTPY_API_KEY without clobbering existing env variables", () => {
    const envPath = join(tempDir, ".env");
    writeFileSync(envPath, "PORT=3000\nDATABASE_URL=postgres://localhost/db\n");

    appendOrUpdateEnvKey(envPath, "OTPY_API_KEY", "otpy_test_123");
    expect(getExistingEnvKey(envPath)).toBe("otpy_test_123");

    // Check that original keys are preserved
    const getPort = getExistingEnvKey(envPath, "PORT");
    expect(getPort).toBe("3000");

    // Update the key
    appendOrUpdateEnvKey(envPath, "OTPY_API_KEY", "otpy_new_456");
    expect(getExistingEnvKey(envPath)).toBe("otpy_new_456");
  });

  it("checks an API key through usage without turning a failed check into a throw", async () => {
    const fetchFn = async () => new Response(JSON.stringify({ free_used_today: 0 }), { status: 200 });
    await expect(validateApiKey("otpy_valid", fetchFn)).resolves.toEqual({ ok: true });

    const invalidFetch = async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    await expect(validateApiKey("otpy_invalid", invalidFetch)).resolves.toMatchObject({
      ok: false,
      reason: "API returned HTTP 401",
    });
  });

  it("adds the selected env file to a git repository's ignore rules once", () => {
    spawnSync("git", ["init"], { cwd: tempDir, stdio: "ignore" });
    const envPath = join(tempDir, ".env.local");
    writeFileSync(envPath, "OTPY_API_KEY=secret\n");

    expect(ensureEnvFileIgnored(tempDir, envPath)).toBe(true);
    expect(readFileSync(join(tempDir, ".gitignore"), "utf8")).toContain(".env.local");
    expect(ensureEnvFileIgnored(tempDir, envPath)).toBe(false);
    expect(readFileSync(join(tempDir, ".gitignore"), "utf8").match(/\.env\.local/g)).toHaveLength(1);
  });

  it("does not persist a placeholder key when init receives empty input", () => {
    // Given: a project with an existing env file and no API key
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({ name: "fixture" }));
    const envPath = join(tempDir, ".env");
    writeFileSync(envPath, "PORT=3000\n");
    const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));

    // When: init receives an empty API key response
    const result = spawnSync(process.execPath, ["--import", requireFromTest.resolve("tsx"), cliPath], {
      cwd: tempDir,
      encoding: "utf8",
      input: "\n",
    });

    // Then: the existing file has no placeholder and the dashboard hint is shown
    expect(result.status).toBe(0);
    expect(readFileSync(envPath, "utf8")).not.toContain("otpy_test_key_replace_with_yours");
    expect(result.stdout).toContain("https://dash.otpy.ir");
  });

  it("generates templates for all supported stacks", () => {
    const nextFiles = generateNextAppTemplates(false, true);
    expect(nextFiles.some((f) => f.path.includes("lib/otpy.ts"))).toBe(true);
    expect(nextFiles.some((f) => f.path.includes("send/route.ts"))).toBe(true);

    const expressFiles = generateExpressTemplates(true, true);
    expect(expressFiles.some((f) => f.path.includes("src/routes/otp.ts"))).toBe(true);

    const pythonFiles = generatePythonFastApiTemplates();
    expect(pythonFiles.some((f) => f.path.includes("routers/otp.py"))).toBe(true);
    expect(pythonFiles.map((file) => file.content).join("\n")).toContain("pip install requests fastapi");

    const pyClient = generatePythonTemplates();
    expect(pyClient.some((f) => f.path === "otpy_client.py")).toBe(true);
    const pyClientContent = pyClient.map((file) => file.content).join("\n");
    expect(pyClientContent).toContain("import requests");
    expect(pyClientContent).not.toContain("fastapi");
    expect(pyClientContent).not.toContain("APIRouter");

    const goFiles = generateGoTemplates();
    expect(goFiles.some((f) => f.path.includes("pkg/otpy/client.go"))).toBe(true);
    expect(goFiles[0]?.content).toContain("func (c *OtpClient) Verify(phone, code string) (bool, error)");
    expect(goFiles[0]?.content).toContain("/v1/otp/verify");
  });

  it("validates an unknown project without generating Next.js files", () => {
    const before = readdirSync(tempDir, { recursive: true, encoding: "utf8" });
    writeFileSync(join(tempDir, "notes.txt"), "plain project\n");
    const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));

    const result = spawnSync(
      process.execPath,
      ["--import", requireFromTest.resolve("tsx"), cliPath, "init", "--api-key", "otpy_test_key_123"],
      { cwd: tempDir, encoding: "utf8", env: { ...process.env, OTPY_BASE_URL: "http://127.0.0.1:1" } },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No supported framework detected");
    expect(result.stdout).toContain("https://api.otpy.ir/v1/otp/send");
    expect(result.stdout).toContain("https://api.otpy.ir/v1/otp/verify");
    const created = readdirSync(tempDir, { recursive: true, encoding: "utf8" }).filter(
      (entry) => !before.includes(entry) && entry !== "notes.txt" && entry !== ".env",
    );
    expect(created).not.toContain("app/api/auth/otp/send/route.ts");
    expect(existsSync(join(tempDir, "app/api/auth/otp/send/route.ts"))).toBe(false);
  });
});

describe("otpy cli sveltekit template", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "otpy-cli-sveltekit-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeSvelteKitFixture(dir: string): void {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "sveltekit-fixture",
        private: true,
        devDependencies: { "@sveltejs/kit": "^2.5.0", svelte: "^5.0.0" },
      }),
    );
    writeFileSync(join(dir, "tsconfig.json"), "{}");
    writeFileSync(join(dir, ".env"), "PORT=5173\n");
    mkdirSync(join(dir, "src", "routes"), { recursive: true });
  }

  function listFiles(root: string): string[] {
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => statSync(join(root, entry)).isFile())
      .sort();
  }

  it("detects a SvelteKit project and keeps the existing .env as the env file", () => {
    writeSvelteKitFixture(tempDir);

    const info = detectProject(tempDir);

    expect(info.framework).toBe("sveltekit");
    expect(info.isTypeScript).toBe(true);
    expect(info.envFilePath).toBe(join(tempDir, ".env"));
  });

  it("generates exactly the three SvelteKit files with $lib imports and no relative or @/ imports", () => {
    const files = generateSvelteKitTemplates();

    expect(files.map((f) => f.path)).toEqual([
      "src/lib/otpy.ts",
      "src/routes/auth/otp/send/+server.ts",
      "src/routes/auth/otp/verify/+server.ts",
    ]);

    const libFile = files.find((f) => f.path === "src/lib/otpy.ts")!;
    expect(libFile.content).toContain('from "@o-t-p-y/sdk"');
    expect(libFile.content).toContain('from "$env/dynamic/private"');

    for (const file of files) {
      expect(file.content).not.toMatch(/from\s+"\.\.?\//); // no relative imports
      expect(file.content).not.toContain("@/"); // no Next-style alias
    }

    for (const routeFile of files.filter((f) => f.path.endsWith("+server.ts"))) {
      expect(routeFile.content).toContain('from "$lib/otpy"');
      expect(routeFile.content).toContain('from "@sveltejs/kit"');
      expect(routeFile.content).toContain("export const POST");
    }
  });

  it("init on a SvelteKit project creates only the three target files (no Next fall-through)", () => {
    writeSvelteKitFixture(tempDir);
    const before = listFiles(tempDir);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("sveltekit");

    const created = listFiles(tempDir).filter((f) => !before.includes(f));
    expect(created).toEqual([
      "src/lib/otpy.ts",
      "src/routes/auth/otp/send/+server.ts",
      "src/routes/auth/otp/verify/+server.ts",
    ]);

    // Then: no Next.js App Router artifacts appear and the existing .env keys survive
    expect(existsSync(join(tempDir, "src/app/api/auth/otp/send/route.ts"))).toBe(false);
    expect(existsSync(join(tempDir, "src/app/api/auth/otp/verify/route.ts"))).toBe(false);

    const env = readFileSync(join(tempDir, ".env"), "utf8");
    expect(env).toContain("PORT=5173");
    expect(env).toContain("OTPY_API_KEY=otpy_test_key_123");
  });

  it("init skips an existing src/lib/otpy.ts instead of clobbering it", () => {
    writeSvelteKitFixture(tempDir);
    const marker = "// custom client setup";
    mkdirSync(join(tempDir, "src/lib"), { recursive: true });
    writeFileSync(join(tempDir, "src/lib/otpy.ts"), marker);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(readFileSync(join(tempDir, "src/lib/otpy.ts"), "utf8")).toBe(marker);
    expect(result.stdout).toContain("skipped");
  });
});

describe("otpy cli next-pages template", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "otpy-cli-nextpages-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  type PagesLayout = "root" | "src" | "both" | "none";

  function writeNextFixture(dir: string, pages: PagesLayout, withAppDir = false): void {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "next-fixture",
        private: true,
        dependencies: { next: "15.0.0", react: "19.0.0" },
      }),
    );
    writeFileSync(join(dir, "tsconfig.json"), "{}");
    writeFileSync(join(dir, ".env"), "PORT=3000\n");
    if (withAppDir) {
      mkdirSync(join(dir, "app"), { recursive: true });
    }
    if (pages === "root" || pages === "both") {
      mkdirSync(join(dir, "pages"), { recursive: true });
    }
    if (pages === "src" || pages === "both") {
      mkdirSync(join(dir, "src", "pages"), { recursive: true });
    }
  }

  function listFiles(root: string): string[] {
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => statSync(join(root, entry)).isFile())
      .sort();
  }

  it("detects next-app when an app dir exists, even alongside a pages dir", () => {
    // Given: a Next project with BOTH an app dir and a root pages dir
    writeNextFixture(tempDir, "root", true);

    // When: the CLI detects the project
    const info = detectProject(tempDir);

    // Then: the App Router wins — the pages dir must not shadow it
    expect(info.framework).toBe("next-app");
  });

  it("detects the pages root with root pages/ winning over src/pages/", () => {
    // Given: only a root pages dir
    writeNextFixture(tempDir, "root");
    expect(detectNextPagesRoot(tempDir)).toBe("pages");

    // And: only a src/pages dir
    const srcDir = mkdtempSync(join(tmpdir(), "otpy-cli-nextpages-src-"));
    try {
      writeNextFixture(srcDir, "src");
      expect(detectNextPagesRoot(srcDir)).toBe("src/pages");

      // And: both dirs present — Next.js ignores src/pages when root pages exists
      mkdirSync(join(srcDir, "pages"), { recursive: true });
      expect(detectNextPagesRoot(srcDir)).toBe("pages");

      // And: neither dir present — default to the canonical root pages location
      rmSync(join(srcDir, "pages"), { recursive: true });
      rmSync(join(srcDir, "src", "pages"), { recursive: true });
      expect(detectNextPagesRoot(srcDir)).toBe("pages");
    } finally {
      rmSync(srcDir, { recursive: true, force: true });
    }
  });

  it("generates root pages-router files with NextApiRequest/NextApiResponse handlers", () => {
    const files = generateNextPagesTemplates(false, true);

    expect(files.map((f) => f.path)).toEqual([
      "lib/otpy.ts",
      "pages/api/auth/otp/send.ts",
      "pages/api/auth/otp/verify.ts",
    ]);

    for (const file of files) {
      expect(file.content).not.toContain("app/api");
      expect(file.content).not.toContain("next/server");
      expect(file.content).not.toContain("NextResponse");
    }

    for (const routeFile of files.filter((f) => f.path.includes("pages/api"))) {
      expect(routeFile.content).toContain('from "next"');
      expect(routeFile.content).toContain("NextApiRequest");
      expect(routeFile.content).toContain("NextApiResponse");
      expect(routeFile.content).toContain("export default");
      expect(routeFile.content).toContain("../../../../lib/otpy");
    }
  });

  it("generates src pages-router files preserving the detected src root", () => {
    const files = generateNextPagesTemplates(true, true);

    expect(files.map((f) => f.path)).toEqual([
      "src/lib/otpy.ts",
      "src/pages/api/auth/otp/send.ts",
      "src/pages/api/auth/otp/verify.ts",
    ]);

    for (const routeFile of files.filter((f) => f.path.includes("pages/api"))) {
      // four levels up from src/pages/api/auth/otp lands on src/ — same depth as the root layout
      expect(routeFile.content).toContain("../../../../lib/otpy");
    }
  });

  it("generates JavaScript variants for non-TypeScript projects", () => {
    const files = generateNextPagesTemplates(false, false);

    expect(files.map((f) => f.path)).toEqual([
      "lib/otpy.js",
      "pages/api/auth/otp/send.js",
      "pages/api/auth/otp/verify.js",
    ]);
    for (const routeFile of files.filter((f) => f.path.includes("pages/api"))) {
      expect(routeFile.content).not.toContain("NextApiRequest");
      expect(routeFile.content).toContain("export default");
    }
  });

  it("init on a root pages/ project creates only pages-router files (no App Router fall-through)", () => {
    writeNextFixture(tempDir, "root");
    const before = listFiles(tempDir);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("next-pages");

    const created = listFiles(tempDir).filter((f) => !before.includes(f));
    expect(created).toEqual([
      "lib/otpy.ts",
      "pages/api/auth/otp/send.ts",
      "pages/api/auth/otp/verify.ts",
    ]);

    // Then: no App Router artifacts appear and the existing .env keys survive
    expect(existsSync(join(tempDir, "app/api/auth/otp/send/route.ts"))).toBe(false);
    expect(existsSync(join(tempDir, "src/pages/api/auth/otp/send.ts"))).toBe(false);

    const env = readFileSync(join(tempDir, ".env"), "utf8");
    expect(env).toContain("PORT=3000");
    expect(env).toContain("OTPY_API_KEY=otpy_test_key_123");
  });

  it("init on a src/pages/ project writes under src/", () => {
    writeNextFixture(tempDir, "src");
    const before = listFiles(tempDir);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);

    const created = listFiles(tempDir).filter((f) => !before.includes(f));
    expect(created).toEqual([
      "src/lib/otpy.ts",
      "src/pages/api/auth/otp/send.ts",
      "src/pages/api/auth/otp/verify.ts",
    ]);

    expect(existsSync(join(tempDir, "pages/api/auth/otp/send.ts"))).toBe(false);
  });

  it("init prefers root pages/ when both pages/ and src/pages/ exist", () => {
    writeNextFixture(tempDir, "both");

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(existsSync(join(tempDir, "pages/api/auth/otp/send.ts"))).toBe(true);
    expect(existsSync(join(tempDir, "pages/api/auth/otp/verify.ts"))).toBe(true);
    expect(existsSync(join(tempDir, "src/pages/api/auth/otp/send.ts"))).toBe(false);
    expect(existsSync(join(tempDir, "src/lib/otpy.ts"))).toBe(false);
  });

  it("init rerun skips existing files instead of clobbering them", () => {
    writeNextFixture(tempDir, "root");

    const first = runCliInit(tempDir);
    expect(first.status).toBe(0);
    const sendPath = join(tempDir, "pages/api/auth/otp/send.ts");
    const firstContent = readFileSync(sendPath, "utf8");

    const second = runCliInit(tempDir);

    expect(second.status).toBe(0);
    expect(second.stdout).toContain("skipped");
    expect(readFileSync(sendPath, "utf8")).toBe(firstContent);
  });

  it("init on a next-app project still generates App Router files (no pages shadowing)", () => {
    writeNextFixture(tempDir, "root", true);
    const before = listFiles(tempDir);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("next-app");

    const created = listFiles(tempDir).filter((f) => !before.includes(f));
    expect(created).toEqual([
      "app/api/auth/otp/send/route.ts",
      "app/api/auth/otp/verify/route.ts",
      "lib/otpy.ts",
    ]);
    expect(existsSync(join(tempDir, "pages/api/auth/otp/send.ts"))).toBe(false);
  });
});

describe("otpy cli php-laravel template", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "otpy-cli-php-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const phpAvailable = spawnSync("php", ["-v"], { encoding: "utf8" }).status === 0;

  function writeComposerFixture(dir: string, withArtisan: boolean): void {
    writeFileSync(
      join(dir, "composer.json"),
      JSON.stringify({
        name: "fixture/app",
        require: { php: "^8.2", "laravel/framework": "^11.0" },
      }),
    );
    if (withArtisan) {
      writeFileSync(join(dir, "artisan"), "#!/usr/bin/env php\n<?php\n");
    }
    writeFileSync(join(dir, ".env"), "APP_ENV=local\n");
  }

  function listFiles(root: string): string[] {
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((entry) => statSync(join(root, entry)).isFile())
      .sort();
  }

  it("detects php-laravel only when composer.json is paired with artisan", () => {
    // Given: a composer.json project with the artisan marker
    writeComposerFixture(tempDir, true);
    expect(detectProject(tempDir).framework).toBe("php-laravel");

    // And: without artisan the same project is plain PHP
    rmSync(join(tempDir, "artisan"));
    expect(detectProject(tempDir).framework).toBe("php-generic");
  });

  it("generates the Laravel controller, routes, and config with the HTTP client and no JavaScript", () => {
    const files = generatePhpLaravelTemplates();

    expect(files.map((f) => f.path)).toEqual([
      "config/otpy.php",
      "app/Http/Controllers/OtpController.php",
      "routes/api.php",
    ]);

    const controller = files.find((f) => f.path === "app/Http/Controllers/OtpController.php")!;
    expect(controller.content).toContain("namespace App\\Http\\Controllers;");
    expect(controller.content).toContain("use Illuminate\\Support\\Facades\\Http;");
    expect(controller.content).toContain("Http::withToken(config('otpy.key'))");
    expect(controller.content).toContain("class OtpController extends Controller");
    expect(controller.content).toContain("'/v1/otp/send'");
    expect(controller.content).toContain("'/v1/otp/verify'");

    const config = files.find((f) => f.path === "config/otpy.php")!;
    expect(config.content).toContain("env('OTPY_API_KEY'");

    const routes = files.find((f) => f.path === "routes/api.php")!;
    expect(routes.content).toContain("Route::post('/auth/otp/send', [OtpController::class, 'send'])");
    expect(routes.content).toContain("Route::post('/auth/otp/verify', [OtpController::class, 'verify'])");

    for (const file of files) {
      // Then: never JavaScript for a PHP project
      expect(file.content).not.toMatch(/process\.env|module\.exports|export default|require\(/);
      expect(file.content).not.toContain("npm install");
      // And: never a hardcoded secret
      expect(file.content).not.toContain("otpy_test");
    }
  });

  it.runIf(phpAvailable)("generated php files pass php -l lint", () => {
    const files = generatePhpLaravelTemplates();

    for (const file of files) {
      const target = join(tempDir, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content);

      const lint = spawnSync("php", ["-l", target], { encoding: "utf8" });
      expect(lint.status, `${file.path}: ${lint.stdout}${lint.stderr}`).toBe(0);
    }
  });

  it("init on a Laravel fixture creates only php files (no Next fall-through)", () => {
    writeComposerFixture(tempDir, true);
    const before = listFiles(tempDir);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("php-laravel");

    const created = listFiles(tempDir).filter((f) => !before.includes(f));
    expect(created).toEqual([
      "app/Http/Controllers/OtpController.php",
      "config/otpy.php",
      "routes/api.php",
    ]);

    // Then: no Next.js/JS artifacts appear and the existing .env keys survive
    expect(existsSync(join(tempDir, "lib/otpy.js"))).toBe(false);
    expect(existsSync(join(tempDir, "app/api/auth/otp/send/route.js"))).toBe(false);
    expect(result.stdout).not.toContain("npm install");

    const env = readFileSync(join(tempDir, ".env"), "utf8");
    expect(env).toContain("APP_ENV=local");
    expect(env).toContain("OTPY_API_KEY=otpy_test_key_123");
  });

  it("init prints the routes snippet when routes/api.php already exists instead of clobbering it", () => {
    writeComposerFixture(tempDir, true);
    mkdirSync(join(tempDir, "routes"));
    const marker = "<?php\n// custom routes\n";
    writeFileSync(join(tempDir, "routes/api.php"), marker);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(readFileSync(join(tempDir, "routes/api.php"), "utf8")).toBe(marker);
    expect(result.stdout).toContain("Route::post('/auth/otp/send'");
    expect(result.stdout).toContain("Route::post('/auth/otp/verify'");
  });

  it("init rerun skips existing php files instead of clobbering them", () => {
    writeComposerFixture(tempDir, true);

    const first = runCliInit(tempDir);
    expect(first.status).toBe(0);
    const controllerPath = join(tempDir, "app/Http/Controllers/OtpController.php");
    const firstContent = readFileSync(controllerPath, "utf8");

    const second = runCliInit(tempDir);

    expect(second.status).toBe(0);
    expect(second.stdout).toContain("skipped");
    expect(readFileSync(controllerPath, "utf8")).toBe(firstContent);
  });

  it("php-generic project gets the manual guide message and no generated files", () => {
    writeComposerFixture(tempDir, false);
    const before = listFiles(tempDir);

    const result = runCliInit(tempDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("php-generic");
    expect(result.stdout).toContain("Integration complete!");
    expect(result.stdout).toContain("https://otpy.ir/docs");

    const created = listFiles(tempDir).filter((f) => !before.includes(f));
    expect(created).toEqual([]);

    // Then: no Next.js/JS artifacts and no npm guidance for a plain PHP project
    expect(existsSync(join(tempDir, "lib/otpy.js"))).toBe(false);
    expect(existsSync(join(tempDir, "app/Http/Controllers/OtpController.php"))).toBe(false);
    expect(result.stdout).not.toContain("npm install");
  });
});

describe("otpy cli ui", () => {
  it("keeps the banner ASCII-only and every box line exactly 56 code points wide", () => {
    const lines = BANNER_TEXT.replace(/^\n/, "").replace(/\n$/, "").split("\n");

    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(line).toMatch(/^[\x20-\x7E│┌┐└┘─]+$/);
      expect([...line]).toHaveLength(56);
    }
  });

  it("uses exactly ten braille frames inside the U+28xx block", () => {
    expect([...BRAILLE_FRAMES]).toHaveLength(10);
    for (const frame of BRAILLE_FRAMES) {
      const codePoint = frame.codePointAt(0)!;
      expect(codePoint).toBeGreaterThanOrEqual(0x2800);
      expect(codePoint).toBeLessThanOrEqual(0x28ff);
    }
  });

  it("degrades to static stderr lines with no frames or ANSI when not interactive", () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stderr.write);
    const previous = process.env.OTPY_NO_SPINNER;
    process.env.OTPY_NO_SPINNER = "1";
    try {
      const first = spinner("working");
      first.succeed("done");
      first.fail("ignored");

      const second = spinner("working again");
      second.fail("nope");
      second.stop();
    } finally {
      spy.mockRestore();
      if (previous === undefined) {
        delete process.env.OTPY_NO_SPINNER;
      } else {
        process.env.OTPY_NO_SPINNER = previous;
      }
    }

    expect(writes).toEqual(["working\n", "done\n", "working again\n", "nope\n"]);
    expect(writes.join("")).not.toContain("\r");
    expect(writes.join("")).not.toContain("\x1b");
  });
});

describe("otpy cli English-only output invariant", () => {
  const persian = /[\u0600-\u06FF\u200C]/;

  const fixtures: Array<{ name: string; setup: (dir: string) => void; args: string[] }> = [
    {
      name: "unknown framework",
      setup: (dir) => {
        writeFileSync(join(dir, "notes.txt"), "plain project\n");
      },
      args: ["init", "--api-key", "otpy_test_key_123"],
    },
    {
      name: "sveltekit",
      setup: (dir) => {
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify({ name: "sveltekit-fixture", devDependencies: { "@sveltejs/kit": "^2.5.0" } }),
        );
        writeFileSync(join(dir, "tsconfig.json"), "{}");
        writeFileSync(join(dir, ".env"), "PORT=5173\n");
        mkdirSync(join(dir, "src", "routes"), { recursive: true });
      },
      args: ["init", "--api-key", "otpy_test_key_123"],
    },
    {
      name: "php-laravel with pre-existing routes/api.php",
      setup: (dir) => {
        writeFileSync(
          join(dir, "composer.json"),
          JSON.stringify({ name: "fixture/app", require: { php: "^8.2", "laravel/framework": "^11.0" } }),
        );
        writeFileSync(join(dir, "artisan"), "#!/usr/bin/env php\n<?php\n");
        writeFileSync(join(dir, ".env"), "APP_ENV=local\n");
        mkdirSync(join(dir, "routes"));
        writeFileSync(join(dir, "routes", "api.php"), "<?php\n// custom routes\n");
      },
      args: ["init", "--api-key", "otpy_test_key_123"],
    },
    {
      name: "init --ai",
      setup: (dir) => {
        writeFileSync(join(dir, "notes.txt"), "plain project\n");
      },
      args: ["init", "--ai", "--api-key", "otpy_test_key_123"],
    },
  ];

  for (const fixture of fixtures) {
    it(`emits no Persian, carriage returns, or ANSI: ${fixture.name}`, () => {
      const dir = mkdtempSync(join(tmpdir(), "otpy-cli-i18n-"));
      try {
        fixture.setup(dir);
        const result = runCli(fixture.args, dir);

        expect(result.status).toBe(0);
        const combined = `${result.stdout}${result.stderr}`;
        expect(combined).not.toMatch(persian);
        expect(combined).not.toContain("\r");
        expect(combined).not.toContain("\x1b");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

describe("otpy cli framework-aware --ai instructions", () => {
  const fixtures: Array<{
    name: string;
    setup: (dir: string) => void;
    expects: string[];
    rejects: string[];
  }> = [
    {
      name: "python-fastapi gets REST instructions",
      setup: (dir) => {
        writeFileSync(join(dir, "requirements.txt"), "fastapi\nuvicorn\n");
      },
      expects: ["REST API: https://api.otpy.ir", "POST /v1/otp/send"],
      rejects: ["@o-t-p-y/sdk", "npm install"],
    },
    {
      name: "go gets REST instructions",
      setup: (dir) => {
        writeFileSync(join(dir, "go.mod"), "module example.com/app\n");
      },
      expects: ["REST API: https://api.otpy.ir", "POST /v1/otp/send"],
      rejects: ["@o-t-p-y/sdk", "npm install"],
    },
    {
      name: "unknown gets REST instructions",
      setup: (dir) => {
        writeFileSync(join(dir, "notes.txt"), "plain project\n");
      },
      expects: ["REST API: https://api.otpy.ir"],
      rejects: ["@o-t-p-y/sdk"],
    },
    {
      name: "express gets SDK instructions",
      setup: (dir) => {
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify({ name: "express-fixture", dependencies: { express: "^4.19.2" } }),
        );
      },
      expects: ["@o-t-p-y/sdk"],
      rejects: ["REST API"],
    },
    {
      name: "python-django gets REST instructions and a neutral client",
      setup: (dir) => {
        writeFileSync(join(dir, "requirements.txt"), "django\n");
        writeFileSync(join(dir, "manage.py"), "#!/usr/bin/env python\n");
      },
      expects: ["REST API: https://api.otpy.ir", "created otpy_client.py"],
      rejects: ["@o-t-p-y/sdk", "routers/otp.py", "npm install"],
    },
    {
      name: "hybrid package.json + requirements.txt gets REST, not JS files",
      setup: (dir) => {
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "hybrid" }));
        writeFileSync(join(dir, "requirements.txt"), "fastapi\nuvicorn\n");
      },
      expects: ["REST API: https://api.otpy.ir", "no npm package needed"],
      rejects: ["@o-t-p-y/sdk", "npm install"],
    },
    {
      name: "php-laravel keeps REST instructions",
      setup: (dir) => {
        writeFileSync(
          join(dir, "composer.json"),
          JSON.stringify({ require: { php: "^8.2", "laravel/framework": "^11.0" } }),
        );
        writeFileSync(join(dir, "artisan"), "#!/usr/bin/env php\n<?php\n");
      },
      expects: ["REST API: https://api.otpy.ir", "php artisan serve"],
      rejects: ["@o-t-p-y/sdk", "Install the SDK"],
    },
  ];

  for (const fixture of fixtures) {
    it(fixture.name, () => {
      const dir = mkdtempSync(join(tmpdir(), "otpy-cli-ai-"));
      try {
        fixture.setup(dir);
        const result = runCli(["init", "--ai", "--api-key", "otpy_test_key_123"], dir);

        expect(result.status).toBe(0);
        const output = `${result.stdout}${result.stderr}`;
        for (const expected of fixture.expects) {
          expect(output).toContain(expected);
        }
        for (const rejected of fixture.rejects) {
          expect(output).not.toContain(rejected);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
