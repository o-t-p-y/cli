#!/usr/bin/env node
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import packageMetadata from "../package.json" with { type: "json" };
import { detectNextPagesRoot, detectProject } from "./detector.js";
import { appendOrUpdateEnvKey, ensureEnvFileIgnored, getExistingEnvKey, validateApiKey } from "./env.js";
import {
  generateExpressTemplates,
  generateGoTemplates,
  generateNextAppTemplates,
  generateNextPagesTemplates,
  generatePhpLaravelTemplates,
  generatePythonFastApiTemplates,
  generateSvelteKitTemplates,
  phpLaravelRoutesSnippet,
  type GeneratedFile,
} from "./templates.js";
import { printBanner, spinner } from "./ui.js";

const args = process.argv.slice(2);
const command = args[0] || "init";
const placeholderApiKey = "otpy_test_key_replace_with_yours";

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runInit() {
  printBanner();
  const cwd = process.cwd();
  const info = detectProject(cwd);

  console.log(`🔍 Scanning project...`);
  console.log(`   Detected framework: ${info.framework}`);
  console.log(`   TypeScript: ${info.isTypeScript ? "yes" : "no"}`);
  console.log(`   Env file: ${info.envFilePath}\n`);

  let apiKey: string | null = getExistingEnvKey(info.envFilePath);
  const cliKeyArgIndex = args.indexOf("--api-key");
  if (cliKeyArgIndex !== -1 && args[cliKeyArgIndex + 1]) {
    apiKey = args[cliKeyArgIndex + 1] ?? null;
  }

  if (!apiKey) {
    console.log(`💡 Enter your project API key (copy it from https://dash.otpy.ir):`);
    apiKey = (await prompt("🔑 API key: ")) || null;
  }

  if (apiKey && apiKey !== placeholderApiKey) {
    const s = spinner("🔑 Validating API key...");
    const validation = await validateApiKey(apiKey).finally(() => s.stop());
    if (validation.ok) {
      console.log(`✅ API key validated.`);
    } else {
      console.log(`⚠️  Key validation failed (${validation.reason}). Continuing anyway — double-check the key later.`);
    }
    appendOrUpdateEnvKey(info.envFilePath, "OTPY_API_KEY", apiKey);
    console.log(`\n✅ Key saved to ${info.envFilePath}.`);
  } else {
    console.log(`\n💡 Get your API key at https://dash.otpy.ir`);
  }

  if (ensureEnvFileIgnored(cwd, info.envFilePath)) {
    console.log(`✅ Added ${info.envFilePath} to .gitignore.`);
  }

  // Generate templates
  let filesToGenerate: GeneratedFile[] = [];
  if (info.framework === "next-app") {
    filesToGenerate = generateNextAppTemplates(info.hasSrcDir, info.isTypeScript);
  } else if (info.framework === "next-pages") {
    filesToGenerate = generateNextPagesTemplates(
      detectNextPagesRoot(cwd) === "src/pages",
      info.isTypeScript,
    );
  } else if (info.framework === "sveltekit") {
    filesToGenerate = generateSvelteKitTemplates();
  } else if (info.framework === "express" || info.framework === "node-generic") {
    filesToGenerate = generateExpressTemplates(info.hasSrcDir, info.isTypeScript);
  } else if (info.framework === "python-fastapi" || info.framework === "python-django") {
    filesToGenerate = generatePythonFastApiTemplates();
  } else if (info.framework === "go") {
    filesToGenerate = generateGoTemplates();
  } else if (info.framework === "php-laravel") {
    filesToGenerate = generatePhpLaravelTemplates();
    if (existsSync(join(cwd, "routes/api.php"))) {
      console.log(`\n📝 routes/api.php already exists — append these lines manually:`);
      console.log(phpLaravelRoutesSnippet);
    }
  } else if (info.framework === "php-generic") {
    filesToGenerate = [];
    console.log(`\n🐘 PHP project detected, but no supported framework (Laravel) found.`);
    console.log(`   Manual integration guide: https://otpy.ir/docs`);
    console.log(`   Send OTP with cURL:`);
    console.log(`   curl -X POST https://api.otpy.ir/v1/otp/send \\`);
    console.log(`     -H "Authorization: Bearer $OTPY_API_KEY" -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"phone":"09123456789"}'`);
  } else {
    filesToGenerate = [];
    console.log(`\n📝 No supported framework detected; no files were generated.`);
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

  if (filesToGenerate.length > 0) {
    console.log(`\n📦 Generating integration files:`);
    for (const file of filesToGenerate) {
      const fullPath = join(cwd, file.path);
      const parentDir = dirname(fullPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      if (!existsSync(fullPath)) {
        writeFileSync(fullPath, file.content, "utf8");
        console.log(`   ✅ created ${file.path}`);
      } else {
        console.log(`   ⏭️  skipped (exists): ${file.path}`);
      }
    }
  }

  if (args.includes("--ai")) {
    console.log(`\n🤖 AI assistant instructions (Cursor / Windsurf / Claude Code):`);
    if (info.framework === "php-laravel" || info.framework === "php-generic") {
      console.log(`   - REST API: https://api.otpy.ir`);
      console.log(`   - Send: POST /v1/otp/send with body {"phone": "09123456789"}`);
      console.log(`   - Verify: POST /v1/otp/verify with body {"phone": "09123456789", "code": "123456"} → {verified: boolean}`);
    } else {
      console.log(`   - Library: @o-t-p-y/sdk`);
      console.log(`   - Send: otpy.sendOtp(phone) -> { request_id, ttl_seconds }`);
      console.log(`   - Verify: otpy.verifyOtp(phone, code) -> { verified: true }`);
    }
  }

  if (info.framework === "php-generic") {
    console.log(`
For the full manual integration guide, see https://otpy.ir/docs
Dashboard & live stats: https://dash.otpy.ir
`);
  } else if (info.framework === "php-laravel") {
    console.log(`
🎉 Integration complete!

Next steps:
  1. Start the dev server: php artisan serve
  2. Test send: curl -X POST http://localhost:8000/api/auth/otp/send -H "Content-Type: application/json" -d '{"phone":"09123456789"}'
  3. Dashboard & live stats: https://dash.otpy.ir
`);
  } else {
    console.log(`
🎉 Integration complete!

Next steps:
  1. Install the SDK: npm install @o-t-p-y/sdk
  2. Send a test SMS: npx @o-t-p-y/cli test 09123456789
  3. Dashboard & live stats: https://dash.otpy.ir
`);
  }
}

async function runTest() {
  const phone = args[1];
  if (!phone || !/^09\d{9}$/.test(phone)) {
    // Error lines stay on stdout (behavior preserved); only the spinner uses stderr.
    console.log("❌ Error: a valid mobile number is required. Example: npx @o-t-p-y/cli test 09123456789");
    process.exit(1);
  }

  const info = detectProject(process.cwd());
  const apiKey = getExistingEnvKey(info.envFilePath);
  if (!apiKey) {
    console.log("❌ OTPY_API_KEY not found in .env — run npx @o-t-p-y/cli init first.");
    process.exit(1);
  }

  const s = spinner(`🚀 Sending test OTP to ${phone}...`);
  try {
    const res = await fetch("https://api.otpy.ir/v1/otp/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await res.json()) as { request_id?: string; error?: string; free?: boolean };
    s.stop();
    if (res.ok) {
      console.log(`✅ SMS sent!`);
      console.log(`   Request ID: ${data.request_id}`);
      console.log(`   Billing: ${data.free ? "daily free quota" : "paid credit"}`);
    } else {
      console.log(`❌ Failed to send SMS: ${data.error || res.statusText}`);
    }
  } catch (err) {
    s.stop();
    console.log(`❌ Network error: ${String(err)}`);
  }
}

async function runUsage() {
  const info = detectProject(process.cwd());
  const apiKey = getExistingEnvKey(info.envFilePath);
  if (!apiKey) {
    console.log("❌ OTPY_API_KEY not found in .env — run npx @o-t-p-y/cli init first.");
    process.exit(1);
  }

  const s = spinner(`📊 Fetching usage...`);
  try {
    const res = await fetch("https://api.otpy.ir/v1/usage", {
      method: "GET",
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as {
      free_used_today: number;
      free_quota_today: number;
      paid_today: number;
      daily_limit: number | null;
    };
    s.stop();
    if (res.ok) {
      console.log(`📊 Today's usage:`);
      console.log(`   Free quota used: ${data.free_used_today} of ${data.free_quota_today}`);
      console.log(`   Paid SMS: ${data.paid_today}`);
      console.log(`   Daily limit: ${data.daily_limit ? data.daily_limit : "unlimited"}`);
    } else {
      console.log(`❌ Failed to fetch usage.`);
    }
  } catch (err) {
    s.stop();
    console.log(`❌ Network error: ${String(err)}`);
  }
}

if (command === "--version" || command === "-v") {
  console.log(packageMetadata.version);
  process.exit(0);
}

if (command === "--help" || command === "-h") {
  console.log(`
Usage: npx @o-t-p-y/cli <command>
  npx @o-t-p-y/cli init         Set up your project and generate integration files
  npx @o-t-p-y/cli init --ai    Set up with AI assistant instructions
  npx @o-t-p-y/cli test <phone> Send a test OTP SMS to any number
  npx @o-t-p-y/cli usage        Show today's usage and quota
  npx @o-t-p-y/cli --version    CLI version
`);
  process.exit(0);
}

if (command === "init") {
  runInit().catch(console.error);
} else if (command === "test") {
  runTest().catch(console.error);
} else if (command === "usage") {
  runUsage().catch(console.error);
} else {
  console.log(`Unknown command: ${command}\nRun npx @o-t-p-y/cli --help for usage.`);
  process.exit(1);
}
