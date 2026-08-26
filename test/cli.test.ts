import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectProject } from "../src/detector.js";
import { appendOrUpdateEnvKey, getExistingEnvKey } from "../src/env.js";
import {
  generateExpressTemplates,
  generateGoTemplates,
  generateNextAppTemplates,
  generatePythonFastApiTemplates,
} from "../src/templates.js";

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

  it("generates templates for all supported stacks", () => {
    const nextFiles = generateNextAppTemplates(false, true);
    expect(nextFiles.some((f) => f.path.includes("lib/otpy.ts"))).toBe(true);
    expect(nextFiles.some((f) => f.path.includes("send/route.ts"))).toBe(true);

    const expressFiles = generateExpressTemplates(true, true);
    expect(expressFiles.some((f) => f.path.includes("src/routes/otp.ts"))).toBe(true);

    const pythonFiles = generatePythonFastApiTemplates();
    expect(pythonFiles.some((f) => f.path.includes("routers/otp.py"))).toBe(true);

    const goFiles = generateGoTemplates();
    expect(goFiles.some((f) => f.path.includes("pkg/otpy/client.go"))).toBe(true);
  });
});
