import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

export function getExistingEnvKey(filePath: string, keyName: string = "OTPY_API_KEY"): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, "utf8");
    const match = new RegExp(`^${keyName}=(.*)$`, "m").exec(content);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export function appendOrUpdateEnvKey(filePath: string, keyName: string, keyValue: string): void {
  let content = "";
  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf8");
  }

  const regex = new RegExp(`^${keyName}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${keyName}=${keyValue}`);
  } else {
    const endsWithNewline = content.length === 0 || content.endsWith("\n");
    content = `${content}${endsWithNewline ? "" : "\n"}${keyName}=${keyValue}\n`;
  }

  writeFileSync(filePath, content, "utf8");
}

/**
 * Add the selected env file to the repository's .gitignore when it is not
 * already ignored. Returns false when the project is not inside a git repo or
 * the file is already covered by an ignore rule.
 */
export function ensureEnvFileIgnored(cwd: string, filePath: string): boolean {
  let repoRoot: string;
  try {
    repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return false;
  }

  // macOS commonly exposes /var through a /private/var symlink while git
  // returns the canonical /private path. Normalize both sides before taking
  // the relative path so a valid git checkout is not mistaken for a sibling.
  const realRepoRoot = realpathSync(repoRoot);
  const realCwd = realpathSync(cwd);
  const pathFromCwd = relative(resolve(cwd), resolve(filePath));
  const absoluteEnvPath = resolve(realCwd, pathFromCwd);
  const relativeEnvPath = relative(realRepoRoot, absoluteEnvPath).split(sep).join("/");
  if (!relativeEnvPath || relativeEnvPath.startsWith("../")) return false;

  try {
    execFileSync("git", ["check-ignore", "--no-index", "-q", "--", relativeEnvPath], {
      cwd: realRepoRoot,
      stdio: "ignore",
    });
    return false;
  } catch {
    // No matching ignore rule: append an exact path below.
  }

  const gitignorePath = join(repoRoot, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const suffix = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  const entry = relativeEnvPath === basename(relativeEnvPath) ? relativeEnvPath : `/${relativeEnvPath}`;
  writeFileSync(gitignorePath, `${existing}${suffix}${entry}\n`, "utf8");
  return true;
}

export interface ApiKeyValidation {
  ok: boolean;
  reason?: string;
}

/** Validate a key without making init fail when the API is unavailable. */
export async function validateApiKey(
  apiKey: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
  baseUrl = process.env.OTPY_BASE_URL || "https://api.otpy.ir",
): Promise<ApiKeyValidation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetchFn(`${baseUrl.replace(/\/+$/, "")}/v1/usage`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    return response.ok
      ? { ok: true }
      : { ok: false, reason: `API returned HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, reason: `network check failed (${String(error)})` };
  } finally {
    clearTimeout(timeout);
  }
}
