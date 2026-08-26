import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Framework =
  | "next-app"
  | "next-pages"
  | "sveltekit"
  | "express"
  | "node-generic"
  | "python-fastapi"
  | "python-django"
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
          envFilePath: envLocal ? join(cwd, ".env.local") : join(cwd, ".env.local"),
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

      return {
        framework: "node-generic",
        isTypeScript: hasTsConfig,
        hasSrcDir,
        hasEnvFile,
        envFilePath,
      };
    } catch {
      // Fall through
    }
  }

  // Check Python
  if (
    existsSync(join(cwd, "pyproject.toml")) ||
    existsSync(join(cwd, "requirements.txt")) ||
    existsSync(join(cwd, "Pipfile"))
  ) {
    if (existsSync(join(cwd, "manage.py"))) {
      return {
        framework: "python-django",
        isTypeScript: false,
        hasSrcDir,
        hasEnvFile,
        envFilePath,
      };
    }
    return {
      framework: "python-fastapi",
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

  return {
    framework: "unknown",
    isTypeScript: hasTsConfig,
    hasSrcDir,
    hasEnvFile,
    envFilePath,
  };
}
