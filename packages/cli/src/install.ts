// Installs @o-t-p-y/sdk with the project's own package manager. Zero runtime
// deps: spawnSync with inherited stdio so the user sees the real installer.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SDK_PACKAGE = "@o-t-p-y/sdk";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface InstallCommand {
  command: PackageManager;
  args: string[];
  /** Copy-pasteable form for "Next steps". */
  display: string;
}

export type SpawnFn = (
  command: string,
  args: readonly string[],
  options: { cwd: string; stdio: "inherit"; shell: boolean },
) => { status: number | null; error?: Error };

// Checked in this order when no packageManager field decides.
const LOCKFILES: Array<[string, PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
];

function readPackageJson(dir: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function fromPackageManagerField(dir: string): PackageManager | null {
  const field = readPackageJson(dir)?.packageManager;
  if (typeof field !== "string") return null;
  const name = field.split("@")[0];
  return name === "npm" || name === "pnpm" || name === "yarn" || name === "bun" ? name : null;
}

function fromLockfile(dir: string): PackageManager | null {
  for (const [file, pm] of LOCKFILES) {
    if (existsSync(join(dir, file))) return pm;
  }
  return null;
}

/**
 * The package.json `packageManager` field wins, then the lockfile (pnpm, yarn,
 * bun, npm). Walks up from cwd so a package inside a workspace uses the root's
 * manager; stops at the repository root (.git). Defaults to npm.
 */
export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  let dir = cwd;
  for (;;) {
    const pm = fromPackageManagerField(dir) ?? fromLockfile(dir);
    if (pm) return pm;
    const parent = dirname(dir);
    if (parent === dir || existsSync(join(dir, ".git"))) return "npm";
    dir = parent;
  }
}

export function installCommand(pm: PackageManager, pkg: string): InstallCommand {
  const args = pm === "npm" ? ["install", pkg] : ["add", pkg];
  return { command: pm, args, display: `${pm} ${args.join(" ")}` };
}

export function sdkAlreadyInstalled(cwd: string = process.cwd()): boolean {
  const pkg = readPackageJson(cwd);
  if (!pkg) return false;
  for (const field of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[field];
    if (deps && typeof deps === "object" && SDK_PACKAGE in deps) return true;
  }
  return false;
}

/** Runs the install in cwd; true only on a clean exit. `shell` is needed on Windows for the .cmd shims. */
export function runInstall(cwd: string, cmd: InstallCommand, spawnFn: SpawnFn = spawnSync as unknown as SpawnFn): boolean {
  const result = spawnFn(cmd.command, cmd.args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  return !result.error && result.status === 0;
}

export type SdkOutcome =
  | { kind: "present" }
  | { kind: "installed"; command: string }
  | { kind: "failed"; command: string }
  | { kind: "manual"; command: string };

/**
 * Installs the SDK only with a TTY and when not skipped (--no-install,
 * OTPY_CLI_SKIP_INSTALL). Otherwise returns the command for "Next steps".
 */
export function ensureSdk(opts: { cwd: string; interactive: boolean; skip: boolean; spawnFn?: SpawnFn; onStart?: (command: string) => void }): SdkOutcome {
  if (sdkAlreadyInstalled(opts.cwd)) return { kind: "present" };
  const cmd = installCommand(detectPackageManager(opts.cwd), SDK_PACKAGE);
  if (!opts.interactive || opts.skip) return { kind: "manual", command: cmd.display };
  opts.onStart?.(cmd.display);
  return runInstall(opts.cwd, cmd, opts.spawnFn)
    ? { kind: "installed", command: cmd.display }
    : { kind: "failed", command: cmd.display };
}
