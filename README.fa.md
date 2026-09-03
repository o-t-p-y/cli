<div dir="rtl">

# ابزارهای CLI و SDK اُتی‌پی‌آی‌آر

ابزارهای رسمی جاوااسکریپت/تایپ‌اسکریپت برای [OTPy.ir](https://otpy.ir) — ارسال پیامک کد ورود (OTP) در ایران.

این مخزن یک فضای کاری pnpm با دو پکیج منتشرشده است:

| پکیج | npm | توضیح |
|---|---|---|
| [`@o-t-p-y/sdk`](packages/otpy) | `npm install @o-t-p-y/sdk` | SDK تایپ‌اسکریپت بدون وابستگی — ارسال و تایید کد ورود |
| [`@o-t-p-y/cli`](packages/cli) | `npx @o-t-p-y/cli init` | ویزارد ادغام یک‌دستوری — تشخیص فریم‌ورک و تولید روت‌های آماده OTP |

## شروع سریع

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

ویزارد فریم‌ورک‌های Next.js (App/Pages Router)، SvelteKit، Express، Python FastAPI/Django، Go و PHP Laravel را تشخیص می‌دهد، فایل‌های کلاینت و روت‌ها را می‌سازد و `OTPY_API_KEY` را در `.env` ذخیره می‌کند.

## پکیج‌ها

- **[`packages/otpy`](packages/otpy/README.md)** — SDK. بدون وابستگی زمان اجرا؛ سازگار با Node 18+، Bun، Deno، Next.js، Cloudflare Workers و مرورگرها. فرمت شماره موبایل ایرانی (`09xxxxxxxxx`) را پیش از هر درخواست شبکه اعتبارسنجی می‌کند.
- **[`packages/cli`](packages/cli/README.md)** — ویزارد. با باینری `otpy-cli` منتشر می‌شود؛ دستورهای `test` (ارسال پیامک آزمایشی)، `usage` (سهمیه روزانه) و `--ai` (دستورالعمل ادغام برای ایجنت‌ها) را هم دارد.

## مرتبط

- [`@o-t-p-y/mcp`](https://github.com/o-t-p-y/mcp) — سرور Model Context Protocol برای دستیارهای هوش مصنوعی (موجودی، مدیریت کلیدهای API، اسنیپت‌های ادغام).
- [OTPy.ir](https://otpy.ir) — سایت محصول و داشبورد.

## نسخه‌بندی و انتشار

هر پکیج نسخه مستقل دارد. انتشارها با تگ از طریق GitHub Actions و با provenance انجام می‌شود:

- `sdk@x.y.z` → انتشار `@o-t-p-y/sdk`
- `cli@x.y.z` → انتشار `@o-t-p-y/cli`

## مجوز

MIT © [OTPy.ir](https://otpy.ir)

</div>
