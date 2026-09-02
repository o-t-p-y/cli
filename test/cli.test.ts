import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
