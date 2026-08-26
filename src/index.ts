#!/usr/bin/env node
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { detectProject } from "./detector.js";
import { appendOrUpdateEnvKey, getExistingEnvKey } from "./env.js";
import {
  generateExpressTemplates,
  generateGoTemplates,
  generateNextAppTemplates,
  generatePythonFastApiTemplates,
} from "./templates.js";

const args = process.argv.slice(2);
const command = args[0] || "init";

function printBanner() {
  console.log(`
┌────────────────────────────────────────────────────────┐
│  OTPy.ir — سامانه هوشمند ارسال پیامک کد ورود (OTP)     │
│  سریع، اقتصادی، بدون خط اختصاصی و قرارداد              │
└────────────────────────────────────────────────────────┘
`);
}

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

  console.log(`🔍 بررسی پروژه...`);
  console.log(`   فریم‌ورک شناسایی شده: ${info.framework}`);
  console.log(`   پشتیبانی از تایپ‌اسکریپت: ${info.isTypeScript ? "بله" : "خیر"}`);
  console.log(`   فایل محیطی (.env): ${info.envFilePath}\n`);

  let apiKey: string | null = getExistingEnvKey(info.envFilePath);
  const cliKeyArgIndex = args.indexOf("--api-key");
  if (cliKeyArgIndex !== -1 && args[cliKeyArgIndex + 1]) {
    apiKey = args[cliKeyArgIndex + 1] ?? null;
  }

  if (!apiKey) {
    console.log(`💡 کلید API پروژه خود را وارد کنید (یا از داشبورد https://dash.otpy.ir کپی کنید):`);
    const inputKey = await prompt("🔑 کلید API (Enter برای ثبت کلید آزمایشی): ");
    apiKey = inputKey || "otpy_test_key_replace_with_yours";
  }

  // Write to .env
  appendOrUpdateEnvKey(info.envFilePath, "OTPY_API_KEY", apiKey);
  console.log(`\n✔ کلید در فایل ${info.envFilePath} ذخیره شد.`);

  // Generate templates
  let filesToGenerate = [];
  if (info.framework === "next-app") {
    filesToGenerate = generateNextAppTemplates(info.hasSrcDir, info.isTypeScript);
  } else if (info.framework === "express" || info.framework === "node-generic") {
    filesToGenerate = generateExpressTemplates(info.hasSrcDir, info.isTypeScript);
  } else if (info.framework === "python-fastapi" || info.framework === "python-django") {
    filesToGenerate = generatePythonFastApiTemplates();
  } else if (info.framework === "go") {
    filesToGenerate = generateGoTemplates();
  } else {
    filesToGenerate = generateNextAppTemplates(info.hasSrcDir, info.isTypeScript);
  }

  console.log(`\n📦 در حال ایجاد فایل‌های ادغام و کلاینت:`);
  for (const file of filesToGenerate) {
    const fullPath = join(cwd, file.path);
    const parentDir = dirname(fullPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    if (!existsSync(fullPath)) {
      writeFileSync(fullPath, file.content, "utf8");
      console.log(`   + ایجاد فایل: ${file.path}`);
    } else {
      console.log(`   ~ فایل موجود بود (رد شد): ${file.path}`);
    }
  }

  if (args.includes("--ai")) {
    console.log(`\n🤖 دستورالعمل هوش مصنوعی برای ابزارهای Cursor / Windsurf / Claude Code:`);
    console.log(`   - کتابخانه: otpy`);
    console.log(`   - ارسال: otpy.sendOtp(phone) -> { request_id, ttl_seconds }`);
    console.log(`   - تایید: otpy.verifyOtp(phone, code) -> { verified: true }`);
  }

  console.log(`
🎉 تبریک! ادغام با موفقیت انجام شد.

مراحل بعدی:
  ۱. برای نصب پکیج: npm install otpy
  ۲. برای تست ارسال پیامک: npx otpy test 09123456789
  ۳. داشبورد و آمار لحظه‌ای: https://dash.otpy.ir
`);
}

async function runTest() {
  const phone = args[1];
  if (!phone || !/^09\d{9}$/.test(phone)) {
    console.log("❌ خطا: شماره موبایل معتبر الزامی است. مثال: npx otpy test 09123456789");
    process.exit(1);
  }

  const info = detectProject(process.cwd());
  const apiKey = getExistingEnvKey(info.envFilePath);
  if (!apiKey) {
    console.log("❌ کلید OTPY_API_KEY در فایل .env یافت نشد. ابتدا npx otpy init را اجرا کنید.");
    process.exit(1);
  }

  console.log(`🚀 در حال ارسال کد تست به شماره ${phone}...`);
  try {
    const res = await fetch("https://api.otpy.ir/v1/otp/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ phone }),
    });

    const data = (await res.json()) as { request_id?: string; error?: string; free?: boolean };
    if (res.ok) {
      console.log(`✔ پیامک ارسال شد!`);
      console.log(`   شناسه پیامک: ${data.request_id}`);
      console.log(`   نوع مصرف: ${data.free ? "سهمیه رایگان روزانه" : "شارژی"}`);
    } else {
      console.log(`❌ خطا در ارسال پیامک: ${data.error || res.statusText}`);
    }
  } catch (err) {
    console.log(`❌ خطای شبکه: ${String(err)}`);
  }
}

async function runUsage() {
  const info = detectProject(process.cwd());
  const apiKey = getExistingEnvKey(info.envFilePath);
  if (!apiKey) {
    console.log("❌ کلید OTPY_API_KEY در فایل .env یافت نشد.");
    process.exit(1);
  }

  try {
    const res = await fetch("https://api.otpy.ir/v1/usage", {
      method: "GET",
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const data = (await res.json()) as {
      free_used_today: number;
      free_quota_today: number;
      paid_today: number;
      daily_limit: number | null;
    };
    if (res.ok) {
      console.log(`📊 آمار مصرف امروز:`);
      console.log(`   رایگان مصرف شده: ${data.free_used_today} از ${data.free_quota_today}`);
      console.log(`   پیامک‌های شارژی: ${data.paid_today}`);
      console.log(`   سقف کل روزانه: ${data.daily_limit ? data.daily_limit : "نامحدود"}`);
    } else {
      console.log(`❌ خطا در استعلام آمار.`);
    }
  } catch (err) {
    console.log(`❌ خطای شبکه: ${String(err)}`);
  }
}

if (command === "--version" || command === "-v") {
  console.log("otpy-cli 0.1.0");
  process.exit(0);
}

if (command === "--help" || command === "-h") {
  console.log(`
استفاده از دستورات ابزار خط فرمان OTPy:
  npx otpy init         راه‌اندازی خودکار پروژه و تولید فایل‌های آماده
  npx otpy init --ai    راه‌اندازی به همراه راهنمای ایجنت‌های هوش مصنوعی
  npx otpy test <phone> ارسال پیامک تست به شماره دلخواه
  npx otpy usage        مشاهده آمار مصرف امروز سهمیه
  npx otpy --version    نسخه CLI
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
  console.log(`دستور ناشناخته: ${command}\nبرای راهنما npx otpy --help را اجرا کنید.`);
  process.exit(1);
}
