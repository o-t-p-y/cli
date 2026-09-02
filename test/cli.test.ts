import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectProject } from "../src/detector.js";
import { appendOrUpdateEnvKey, getExistingEnvKey } from "../src/env.js";
import {
  generateExpressTemplates,
  generateGoTemplates,
  generateNextAppTemplates,
  generatePythonFastApiTemplates,
  generateSvelteKitTemplates,
} from "../src/templates.js";

const requireFromTest = createRequire(import.meta.url);

describe("otpy cli detector & env", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "otpy-cli-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects Next.js app router and tsconfig", () => {
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

    const goFiles = generateGoTemplates();
    expect(goFiles.some((f) => f.path.includes("pkg/otpy/client.go"))).toBe(true);
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

  function runCliInit(dir: string): ReturnType<typeof spawnSync> {
    const cliPath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    return spawnSync(
      process.execPath,
      ["--import", requireFromTest.resolve("tsx"), cliPath, "init", "--api-key", "otpy_test_key_123"],
      { cwd: dir, encoding: "utf8" },
    );
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
    expect(libFile.content).toContain('from "otpy"');
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
    expect(result.stdout).toContain("رد شد");
  });
});
