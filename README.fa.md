<div dir="rtl">

# 🇮🇷 ابزارهای CLI و SDK اُتی‌پی‌آی‌آر

**ابزارهای رسمی جاوااسکریپت/تایپ‌اسکریپت برای [OTPy.ir](https://otpy.ir) — ارسال پیامک کد ورود (OTP) در ایران.**

<div dir="ltr">

[![CI](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@o-t-p-y/sdk?style=flat-square&color=000000)](https://github.com/o-t-p-y/cli/blob/main/LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-000000?style=flat-square)](https://github.com/o-t-p-y/cli/pulls)

[![sdk npm](https://img.shields.io/npm/v/@o-t-p-y/sdk?style=flat-square&color=000000&label=sdk)](https://www.npmjs.com/package/@o-t-p-y/sdk)
[![cli npm](https://img.shields.io/npm/v/@o-t-p-y/cli?style=flat-square&color=000000&label=cli)](https://www.npmjs.com/package/@o-t-p-y/cli)
[![sdk downloads](https://img.shields.io/npm/dm/@o-t-p-y/sdk?style=flat-square&color=000000&label=sdk%20downloads)](https://www.npmjs.com/package/@o-t-p-y/sdk)
[![cli downloads](https://img.shields.io/npm/dm/@o-t-p-y/cli?style=flat-square&color=000000&label=cli%20downloads)](https://www.npmjs.com/package/@o-t-p-y/cli)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-000000?style=flat-square)](#سازگاری-با-ایجنتهای-کدنویس)
[![Codex](https://img.shields.io/badge/Codex-compatible-000000?style=flat-square)](#سازگاری-با-ایجنتهای-کدنویس)
[![Cursor](https://img.shields.io/badge/Cursor-ready-000000?style=flat-square)](#سازگاری-با-ایجنتهای-کدنویس)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-ready-000000?style=flat-square)](#سازگاری-با-ایجنتهای-کدنویس)
[![Windsurf](https://img.shields.io/badge/Windsurf-ready-000000?style=flat-square)](#سازگاری-با-ایجنتهای-کدنویس)

</div>

این مخزن یک فضای کاری pnpm است که دو پکیج را به‌صورت مستقل منتشر می‌کند.

| پکیج | npm | توضیح |
|---|---|---|
| [`@o-t-p-y/sdk`](packages/otpy) | `npm install @o-t-p-y/sdk` | 🪶 SDK تایپ‌اسکریپت بدون وابستگی — ارسال و تایید کد ورود |
| [`@o-t-p-y/cli`](packages/cli) | `npx @o-t-p-y/cli init` | 🛠️ ویزارد ادغام یک‌دستوری — تشخیص فریم‌ورک و تولید روت‌های آماده OTP |

## 🚀 شروع سریع

**استفاده مستقیم از SDK:**

```bash
npm install @o-t-p-y/sdk
```

```typescript
import { OtpyClient } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({ apiKey: process.env.OTPY_API_KEY! });
const { request_id } = await otpy.sendOtp("09123456789");
const { verified } = await otpy.verifyOtp("09123456789", "123456");
```

**یا ساخت ادغام کامل با ویزارد:**

```bash
npx @o-t-p-y/cli init
```

ویزارد فریم‌ورک‌های Next.js (App/Pages Router)، SvelteKit، Express، Fastify/Koa/Hono، Python FastAPI/Django، Go و PHP Laravel را تشخیص می‌دهد، فایل‌های کلاینت و روت‌ها را می‌سازد و `OTPY_API_KEY` را در `.env` ذخیره می‌کند. برای استک‌های پشتیبانی‌نشده، راهنمای کامل REST چاپ می‌شود.

## 📦 پکیج‌ها

- **[`packages/otpy`](packages/otpy/README.md)** — SDK. بدون وابستگی زمان اجرا؛ سازگار با Node 18+، Bun، Deno، Next.js، Cloudflare Workers و مرورگرها. فرمت شماره موبایل ایرانی (`09xxxxxxxxx`) را پیش از هر درخواست شبکه اعتبارسنجی می‌کند.
- **[`packages/cli`](packages/cli/README.md)** — ویزارد. با باینری `otpy-cli` منتشر می‌شود؛ دستورهای `test` (ارسال پیامک آزمایشی)، `usage` (سهمیه روزانه) و `--ai` (دستورالعمل ادغام برای ایجنت‌ها) را هم دارد.

## 🤖 سازگاری با ایجنت‌های کدنویس

هر دو پکیج برای ایجنت‌های هوش مصنوعی آماده‌اند:

```bash
npx @o-t-p-y/cli init --ai
```

دستورالعمل‌های متنی و آگاه به فریم‌ورک را برای **Claude Code**، **OpenAI Codex**، **Cursor**، **GitHub Copilot**، **Windsurf**، **Gemini CLI** و هر دستیار دیگری که متن را به‌عنوان context می‌پذیرد، چاپ می‌کند.

## 🗂️ ساختار مخزن

```
packages/otpy   @o-t-p-y/sdk  (منتشرشده)
packages/cli    @o-t-p-y/cli  (منتشرشده)
```

## 🧪 توسعه

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

CI هر چهار مرحله را روی هر push و pull request اجرا می‌کند.

## 🔖 نسخه‌بندی و انتشار

هر پکیج نسخه مستقل دارد. انتشارها با تگ از طریق GitHub Actions و با npm provenance (`--provenance`) انجام می‌شود:

| تگ | انتشار |
|---|---|
| `sdk@x.y.z` | `@o-t-p-y/sdk` |
| `cli@x.y.z` | `@o-t-p-y/cli` |

نسخه تگ باید با نسخه `package.json` همان پکیج یکسان باشد.

## مرتبط

- [`@o-t-p-y/mcp`](https://github.com/o-t-p-y/mcp) — سرور Model Context Protocol برای دستیارهای هوش مصنوعی (موجودی، مدیریت کلیدهای API، اسنیپت‌های ادغام).
- [OTPy.ir](https://otpy.ir) — سایت محصول و داشبورد.

## مجوز

MIT © [OTPy.ir](https://otpy.ir)

</div>