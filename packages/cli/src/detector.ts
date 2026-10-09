import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export type Framework =
  | "next-app"
  | "next-pages"
  | "sveltekit"
  | "express"
  | "node-generic"
  | "python-fastapi"
  | "python-django"
  | "python-flask"
  | "python-generic"
  | "php-laravel"
  | "php-generic"
  | "go"
  | "unknown";

export interface ProjectInfo {
  framework: Framework;
  isTypeScript: boolean;
  hasSrcDir: boolean;
  hasEnvFile: boolean;
  envFilePath: string;
}

export type NextPagesRoot = "pages" | "src/pages";
export type NextAppRoot = "app" | "src/app";

// Explicit JS-SDK list: everything else gets REST instructions. Inverting the
// default this way keeps future non-JS frameworks on the safe REST path.
export function usesJsSdk(framework: Framework): boolean {
  return (
    framework === "next-app" ||
    framework === "next-pages" ||
    framework === "sveltekit" ||
    framework === "express" ||
    framework === "node-generic"
  );
}

// Next.js ignores src/pages when a root pages dir exists — root wins.
export function detectNextPagesRoot(cwd: string = process.cwd()): NextPagesRoot {
  if (existsSync(join(cwd, "pages"))) return "pages";
  if (existsSync(join(cwd, "src", "pages"))) return "src/pages";
  return "pages";
}

/** PEP 503 name normalisation: case-insensitive, and runs of -, _ and . are equal. */
function normalizePythonName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

/** Distribution name at the start of a PEP 508 spec ("Flask[async]>=2" -> "flask"). */
function pep508Name(spec: string): string | null {
  const match = /^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/.exec(spec);
  return match ? normalizePythonName(match[1]!) : null;
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function stripTomlComment(line: string): string {
  return line.replace(/(^|\s)#.*$/, "");
}

const QUOTED = /"([^"]*)"|'([^']*)'/g;
const TOML_KEY = /^\s*["']?([A-Za-z0-9][A-Za-z0-9._-]*)["']?\s*=/;

/** Collects quoted PEP 508 specs from a TOML array fragment; returns true while the array stays open. */
function collectArray(fragment: string, deps: Set<string>): boolean {
  for (const match of fragment.matchAll(QUOTED)) {
    const name = pep508Name(match[1] ?? match[2] ?? "");
    if (name) deps.add(name);
  }
  return !fragment.replace(QUOTED, "").includes("]");
}

function scanPyproject(text: string, deps: Set<string>): void {
  let section = "";
  let inArray = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = stripTomlComment(raw);
    if (inArray) {
      inArray = collectArray(line, deps);
      continue;
    }
    const header = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*$/.exec(line);
    if (header) {
      section = header[1]!.replace(/["']/g, "");
      continue;
    }
    // PEP 621 [project] dependencies, optional-dependencies and PEP 735 groups hold spec arrays.
    const arrayStart =
      section === "project"
        ? /^\s*dependencies\s*=\s*\[(.*)$/.exec(line)
        : section === "project.optional-dependencies" || section === "dependency-groups"
          ? /^\s*["']?[A-Za-z0-9._-]+["']?\s*=\s*\[(.*)$/.exec(line)
          : null;
    if (arrayStart) {
      inArray = collectArray(arrayStart[1]!, deps);
      continue;
    }
    // Poetry: dependency names are the table keys.
    if (/^tool\.poetry\.(dev-)?dependencies$|^tool\.poetry\.group\.[^.]+\.dependencies$/.test(section)) {
      const key = TOML_KEY.exec(line)?.[1];
      if (key && key.toLowerCase() !== "python") deps.add(normalizePythonName(key));
    }
  }
}

function scanPipfile(text: string, deps: Set<string>): void {
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = stripTomlComment(raw);
    const header = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*$/.exec(line);
    if (header) {
      section = header[1]!;
      continue;
    }
    if (section !== "packages" && section !== "dev-packages") continue;
    const key = TOML_KEY.exec(line)?.[1];
    if (key) deps.add(normalizePythonName(key));
  }
}

// Follows -r/--requirement includes relative to the including file, but never
// outside the project directory; `seen` stops include cycles.
function scanRequirements(root: string, file: string, deps: Set<string>, seen: Set<string>): void {
  if (seen.has(file)) return;
  seen.add(file);
  const text = readText(file);
  if (!text) return;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    const include = /^(?:-r|--requirement)(?:\s+|=)(\S+)$/.exec(line)?.[1];
    if (include) {
      const target = resolve(dirname(file), include);
      const rel = relative(root, target);
      if (rel && !rel.startsWith("..") && !isAbsolute(rel)) scanRequirements(root, target, deps, seen);
      continue;
    }
    if (!line || line.startsWith("-")) continue; // -e, --index-url ...
    const name = pep508Name(line);
    if (name) deps.add(name);
  }
}

/**
 * Normalised dependency names declared in requirements.txt, pyproject.toml
 * (PEP 621 and Poetry) and Pipfile. A plain-text scan, not a TOML parser:
 * good enough to pick a framework, and it never throws.
 */
export function readPythonDeps(cwd: string = process.cwd()): Set<string> {
  const deps = new Set<string>();

  scanRequirements(cwd, join(cwd, "requirements.txt"), deps, new Set());

  const pyproject = readText(join(cwd, "pyproject.toml"));
  if (pyproject) scanPyproject(pyproject, deps);

  const pipfile = readText(join(cwd, "Pipfile"));
  if (pipfile) scanPipfile(pipfile, deps);

  return deps;
}

// Same rule for the App Router: Next.js ignores src/app when a root app dir exists.
export function detectNextAppRoot(cwd: string = process.cwd()): NextAppRoot {
  if (existsSync(join(cwd, "app"))) return "app";
  if (existsSync(join(cwd, "src", "app"))) return "src/app";
  return "app";
}

export function detectProject(cwd: string = process.cwd()): ProjectInfo {
  const hasPkgJson = existsSync(join(cwd, "package.json"));
  const hasTsConfig = existsSync(join(cwd, "tsconfig.json"));
  const hasSrcDir = existsSync(join(cwd, "src"));

  const envLocal = existsSync(join(cwd, ".env.local"));
  const envMain = existsSync(join(cwd, ".env"));
  const hasEnvFile = envLocal || envMain;
  const envFilePath = envLocal ? join(cwd, ".env.local") : join(cwd, ".env");

  if (hasPkgJson) {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps["next"]) {
        const hasAppDir = existsSync(join(cwd, "app")) || existsSync(join(cwd, "src", "app"));
        return {
          framework: hasAppDir ? "next-app" : "next-pages",
          isTypeScript: hasTsConfig,
          hasSrcDir,
          hasEnvFile,
          envFilePath,
        };
      }

      if (allDeps["@sveltejs/kit"]) {
        return {
          framework: "sveltekit",
          isTypeScript: hasTsConfig,
          hasSrcDir,
          hasEnvFile,
          envFilePath,
        };
      }

      if (allDeps["express"] || allDeps["fastify"] || allDeps["koa"] || allDeps["hono"]) {
        return {
          framework: "express",
          isTypeScript: hasTsConfig,
          hasSrcDir,
          hasEnvFile,
          envFilePath,
        };
      }

      // A bare package.json is not an explicit JavaScript declaration: fall
      // through so non-JS markers below win. Hybrid repos (e.g. a Python
      // backend with a tooling package.json) must not get JS files generated
      // into them. An explicit framework dependency above still wins — a
      // declared dependency is intent, a bare package.json is not.
    } catch {
      // Fall through
    }
  }

  // Check Python: Django, then FastAPI, then Flask, else the neutral client.
  if (
    existsSync(join(cwd, "pyproject.toml")) ||
    existsSync(join(cwd, "requirements.txt")) ||
    existsSync(join(cwd, "Pipfile"))
  ) {
    const deps = readPythonDeps(cwd);
    const framework: Framework =
      existsSync(join(cwd, "manage.py")) || deps.has("django")
        ? "python-django"
        : deps.has("fastapi")
          ? "python-fastapi"
          : deps.has("flask")
            ? "python-flask"
            : "python-generic";
    return {
      framework,
      isTypeScript: false,
      hasSrcDir,
      hasEnvFile,
      envFilePath,
    };
  }

  // Check PHP
  if (existsSync(join(cwd, "composer.json"))) {
    const isLaravel = existsSync(join(cwd, "artisan"));
    return {
      framework: isLaravel ? "php-laravel" : "php-generic",
      isTypeScript: false,
      hasSrcDir,
      hasEnvFile,
      envFilePath,
    };
  }

  // Check Go
  if (existsSync(join(cwd, "go.mod"))) {
    return {
      framework: "go",
      isTypeScript: false,
      hasSrcDir,
      hasEnvFile,
      envFilePath,
    };
  }

  // Bare package.json with no framework deps and no non-JS markers: plain Node.
  if (hasPkgJson) {
    return {
      framework: "node-generic",
      isTypeScript: hasTsConfig,
      hasSrcDir,
      hasEnvFile,
      envFilePath,
    };
  }

  return {
    framework: "unknown",
    isTypeScript: hasTsConfig,
    hasSrcDir,
    hasEnvFile,
    envFilePath,
  };
}
