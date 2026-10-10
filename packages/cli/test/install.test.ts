import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SDK_PACKAGE,
  detectPackageManager,
  ensureSdk,
  installCommand,
  runInstall,
  sdkAlreadyInstalled,
  type SpawnFn,
} from "../src/install.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "otpy-cli-install-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writePkg(dir: string, pkg: Record<string, unknown>): void {
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
}

describe("detectPackageManager", () => {
  const cases: Array<{ name: string; pkg?: Record<string, unknown>; files: string[]; expected: string }> = [
    { name: "no lockfile defaults to npm", files: [], expected: "npm" },
    { name: "package-lock.json", files: ["package-lock.json"], expected: "npm" },
    { name: "pnpm-lock.yaml", files: ["pnpm-lock.yaml"], expected: "pnpm" },
    { name: "yarn.lock", files: ["yarn.lock"], expected: "yarn" },
    { name: "bun.lockb", files: ["bun.lockb"], expected: "bun" },
    { name: "bun.lock", files: ["bun.lock"], expected: "bun" },
    { name: "pnpm wins over a stray package-lock", files: ["pnpm-lock.yaml", "package-lock.json"], expected: "pnpm" },
    { name: "yarn wins over bun", files: ["yarn.lock", "bun.lockb"], expected: "yarn" },
    { name: "packageManager field wins over the lockfile", pkg: { packageManager: "yarn@4.1.0" }, files: ["pnpm-lock.yaml"], expected: "yarn" },
    { name: "packageManager with a hash suffix", pkg: { packageManager: "pnpm@9.0.0+sha512.abc" }, files: [], expected: "pnpm" },
    { name: "unknown packageManager falls back to the lockfile", pkg: { packageManager: "deno@2" }, files: ["bun.lock"], expected: "bun" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      writePkg(tempDir, { name: "fixture", ...c.pkg });
      for (const file of c.files) writeFileSync(join(tempDir, file), "");
      expect(detectPackageManager(tempDir)).toBe(c.expected);
    });
  }

  function nestedProject(): string {
    const nested = join(tempDir, "apps", "web");
    mkdirSync(nested, { recursive: true });
    writePkg(nested, { name: "web" });
    return nested;
  }

  it("finds a pnpm workspace root lockfile from a nested package", () => {
    writePkg(tempDir, { name: "root", private: true });
    writeFileSync(join(tempDir, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
    writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(nestedProject())).toBe("pnpm");
  });

  it("finds a yarn workspaces root (array or object form) from a nested package", () => {
    writePkg(tempDir, { name: "root", private: true, workspaces: { packages: ["apps/*"] } });
    writeFileSync(join(tempDir, "yarn.lock"), "");
    expect(detectPackageManager(nestedProject())).toBe("yarn");
  });

  it("uses the packageManager field of a workspace root", () => {
    writePkg(tempDir, { name: "root", workspaces: ["apps/*"], packageManager: "bun@1.2.0" });
    expect(detectPackageManager(nestedProject())).toBe("bun");
  });

  it("ignores a stray lockfile in a parent folder that is not a workspace root", () => {
    writeFileSync(join(tempDir, "yarn.lock"), "");
    expect(detectPackageManager(nestedProject())).toBe("npm");
  });

  it("ignores a stray package.json with a lockfile or packageManager in a parent folder", () => {
    writePkg(tempDir, { packageManager: "pnpm@9.0.0" });
    writeFileSync(join(tempDir, "package-lock.json"), "");
    writeFileSync(join(tempDir, "yarn.lock"), "");
    expect(detectPackageManager(nestedProject())).toBe("npm");
  });

  it("never reads the home folder or above it", () => {
    const home = join(tempDir, "home");
    const project = join(home, "app");
    mkdirSync(project, { recursive: true });
    writePkg(project, { name: "app" });
    // Both a workspace root above home and home itself would otherwise match.
    writePkg(tempDir, { name: "outer", workspaces: ["*"] });
    writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
    writePkg(home, { name: "home", workspaces: ["*"] });
    writeFileSync(join(home, "yarn.lock"), "");
    expect(detectPackageManager(project, home)).toBe("npm");
  });

  it("stops at the git root", () => {
    writePkg(tempDir, { name: "outer", workspaces: ["*"] });
    writeFileSync(join(tempDir, "yarn.lock"), "");
    const repo = join(tempDir, "repo");
    mkdirSync(join(repo, ".git"), { recursive: true });
    const project = join(repo, "app");
    mkdirSync(project);
    writePkg(project, { name: "app" });
    expect(detectPackageManager(project)).toBe("npm");
  });
});

describe("installCommand", () => {
  it("builds the add command per package manager", () => {
    expect(installCommand("npm", SDK_PACKAGE).display).toBe("npm install @o-t-p-y/sdk");
    expect(installCommand("pnpm", SDK_PACKAGE).display).toBe("pnpm add @o-t-p-y/sdk");
    expect(installCommand("yarn", SDK_PACKAGE).display).toBe("yarn add @o-t-p-y/sdk");
    expect(installCommand("bun", SDK_PACKAGE).display).toBe("bun add @o-t-p-y/sdk");
    expect(installCommand("pnpm", SDK_PACKAGE)).toMatchObject({ command: "pnpm", args: ["add", "@o-t-p-y/sdk"] });
  });
});

describe("sdkAlreadyInstalled", () => {
  it("checks dependencies and devDependencies", () => {
    expect(sdkAlreadyInstalled(tempDir)).toBe(false);
    writePkg(tempDir, { dependencies: { next: "15" } });
    expect(sdkAlreadyInstalled(tempDir)).toBe(false);
    writePkg(tempDir, { dependencies: { "@o-t-p-y/sdk": "^0.3.0" } });
    expect(sdkAlreadyInstalled(tempDir)).toBe(true);
    writePkg(tempDir, { devDependencies: { "@o-t-p-y/sdk": "^0.3.0" } });
    expect(sdkAlreadyInstalled(tempDir)).toBe(true);
    writeFileSync(join(tempDir, "package.json"), "{ not json");
    expect(sdkAlreadyInstalled(tempDir)).toBe(false);
  });
});

describe("runInstall and ensureSdk", () => {
  function fakeSpawn(status: number | null, error?: Error): { fn: SpawnFn; calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> } {
    const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
    const fn: SpawnFn = (command, args, options) => {
      calls.push({ command, args: [...args], options: options as Record<string, unknown> });
      return { status, error } as ReturnType<SpawnFn>;
    };
    return { fn, calls };
  }

  it("runInstall spawns with inherited stdio in the project dir and reports success", () => {
    const spawn = fakeSpawn(0);
    expect(runInstall(tempDir, installCommand("pnpm", SDK_PACKAGE), spawn.fn)).toBe(true);
    expect(spawn.calls).toHaveLength(1);
    expect(spawn.calls[0]).toMatchObject({ command: "pnpm", args: ["add", "@o-t-p-y/sdk"] });
    expect(spawn.calls[0]!.options).toMatchObject({ cwd: tempDir, stdio: "inherit", shell: process.platform === "win32" });
  });

  it("runInstall reports failure on a non-zero exit or a spawn error", () => {
    expect(runInstall(tempDir, installCommand("npm", SDK_PACKAGE), fakeSpawn(1).fn)).toBe(false);
    expect(runInstall(tempDir, installCommand("npm", SDK_PACKAGE), fakeSpawn(null, new Error("ENOENT")).fn)).toBe(false);
  });

  it("ensureSdk installs when interactive and not skipped", () => {
    writePkg(tempDir, { name: "app" });
    writeFileSync(join(tempDir, "yarn.lock"), "");
    const spawn = fakeSpawn(0);
    const outcome = ensureSdk({ cwd: tempDir, interactive: true, skip: false, spawnFn: spawn.fn });
    expect(outcome).toEqual({ kind: "installed", command: "yarn add @o-t-p-y/sdk" });
    expect(spawn.calls).toHaveLength(1);
  });

  it("ensureSdk reports a failed install with the command to retry", () => {
    writePkg(tempDir, { name: "app" });
    const outcome = ensureSdk({ cwd: tempDir, interactive: true, skip: false, spawnFn: fakeSpawn(1).fn });
    expect(outcome).toEqual({ kind: "failed", command: "npm install @o-t-p-y/sdk" });
  });

  it("ensureSdk never spawns without a TTY or when skipped", () => {
    writePkg(tempDir, { name: "app" });
    writeFileSync(join(tempDir, "bun.lockb"), "");
    const spawn = fakeSpawn(0);
    expect(ensureSdk({ cwd: tempDir, interactive: false, skip: false, spawnFn: spawn.fn })).toEqual({
      kind: "manual",
      command: "bun add @o-t-p-y/sdk",
    });
    expect(ensureSdk({ cwd: tempDir, interactive: true, skip: true, spawnFn: spawn.fn })).toEqual({
      kind: "manual",
      command: "bun add @o-t-p-y/sdk",
    });
    expect(spawn.calls).toHaveLength(0);
  });

  it("ensureSdk does nothing when the SDK is already a dependency", () => {
    writePkg(tempDir, { dependencies: { "@o-t-p-y/sdk": "^0.3.0" } });
    const spawn = fakeSpawn(0);
    expect(ensureSdk({ cwd: tempDir, interactive: true, skip: false, spawnFn: spawn.fn })).toEqual({ kind: "present" });
    expect(spawn.calls).toHaveLength(0);
  });
});
