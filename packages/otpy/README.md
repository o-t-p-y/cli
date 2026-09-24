<div align="center">

# 📲 OTPy SDK

**Send and verify Iranian login OTPs over SMS — in seconds, with zero dependencies.**

[![npm version](https://img.shields.io/npm/v/@o-t-p-y/sdk?style=flat-square&color=000000&label=npm)](https://www.npmjs.com/package/@o-t-p-y/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@o-t-p-y/sdk?style=flat-square&color=000000)](https://www.npmjs.com/package/@o-t-p-y/sdk)
[![CI](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@o-t-p-y/sdk?style=flat-square&color=000000)](https://github.com/o-t-p-y/cli/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@o-t-p-y/sdk?style=flat-square&color=000000)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-0-000000?style=flat-square)](#-features)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-000000?style=flat-square)](https://www.typescriptlang.org)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![Codex](https://img.shields.io/badge/Codex-compatible-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![Cursor](https://img.shields.io/badge/Cursor-ready-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-ready-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![Windsurf](https://img.shields.io/badge/Windsurf-ready-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)

**Zero dependencies · Full TypeScript · Node 18+ · Bun · Deno · Workers · Browser**

[Product](https://otpy.ir) · [Dashboard](https://dash.otpy.ir) · [Docs](https://otpy.ir/docs) · [Issues](https://github.com/o-t-p-y/cli/issues)

</div>

---

## Why OTPy?

OTPy handles the hard parts of phone-login OTP for Iranian apps: SMS delivery,
per-number rate limits, daily free quota, CAS-safe verification, and a
boolean-only verdict that never leaks whether a code was wrong or expired.

This package is the official SDK — a tiny, typed wrapper over the
[OTPy REST API](https://api.otpy.ir) that works everywhere `fetch` does.

## ✨ Features

- 🪶 **Zero runtime dependencies** — built on native `fetch` and `AbortController`.
- 🧠 **Full TypeScript** — every request, response, and error is typed; no `any`.
- 🌍 **Runs anywhere** — Node.js 18+, Bun, Deno, Next.js, SvelteKit, Express, Cloudflare Workers, and browsers.
- 📵 **Pre-network phone validation** — rejects malformed numbers (`09xxxxxxxxx`) before any HTTP call.
- 🔒 **Boolean-only verify** — `verifyOtp` returns `{ verified }`, nothing more to leak.
- ⏱️ **Built-in timeouts** — every request has a configurable abort deadline.
- 🧪 **Tested** — the full surface is covered by the CI suite on every push.

## 📦 Installation

```bash
npm install @o-t-p-y/sdk
# or
pnpm add @o-t-p-y/sdk
# or
yarn add @o-t-p-y/sdk
# or
bun add @o-t-p-y/sdk
```

## 🚀 Quick Start

### 1. Initialize the client

```ts
import { OtpyClient } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({
  apiKey: process.env.OTPY_API_KEY!,
});
```

### 2. Send an OTP

```ts
const { request_id, ttl_seconds, free } = await otpy.sendOtp("09123456789");

console.log(`Sent ${request_id} (expires in ${ttl_seconds}s, free: ${free})`);
```

### 3. Verify an OTP

```ts
const { verified } = await otpy.verifyOtp("09123456789", "123456");

if (verified) {
  // Authenticated — issue your session here.
} else {
  // Wrong or expired code.
}
```

### 4. Check daily usage

```ts
const usage = await otpy.usage();

console.log(`Free: ${usage.free_used_today}/${usage.free_quota_today}`);
console.log(`Paid today: ${usage.paid_today}`);
console.log(`Daily limit: ${usage.daily_limit ?? "unlimited"}`);
```

## 📚 API Reference

### `new OtpyClient(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | **Required.** Project API key. |
| `baseUrl` | `string` | `https://api.otpy.ir` | API origin. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation. |
| `timeoutMs` | `number` | `15000` | Per-request abort deadline. |

### Methods

| Method | Request | Resolves to |
|---|---|---|
| `sendOtp(phone)` | `POST /v1/otp/send` | `{ request_id: string; ttl_seconds: number; free: boolean }` |
| `verifyOtp(phone, code)` | `POST /v1/otp/verify` | `{ verified: boolean }` |
| `usage()` | `GET /v1/usage` | `{ free_used_today: number; free_quota_today: number; paid_today: number; daily_limit: number \| null }` |

## 🚨 Error Handling

All failures throw an `OtpyError` with a machine-readable `code` and an HTTP
`status` (or `0` for client-side errors).

```ts
import { OtpyClient, OtpyError } from "@o-t-p-y/sdk";

try {
  await otpy.sendOtp("09123456789");
} catch (error) {
  if (error instanceof OtpyError) {
    console.error(`[${error.code}] HTTP ${error.status}: ${error.message}`);
  }
}
```

| Code | Status | Meaning |
|---|---|---|
| `missing_api_key` | `0` | Empty `apiKey` passed to the constructor. |
| `bad_phone` | `0` | Phone is not a valid `09xxxxxxxxx` number. |
| `bad_otp` | `0` | Verification code was empty. |
| `timeout` | `0` | Request exceeded `timeoutMs`. |
| `network_error` | `0` | Network/transport failure. |
| `http_error` | HTTP | Non-2xx response without a server `error` code; otherwise the server code is used. |

## 🧩 Framework Recipes

<details>
<summary><strong>Next.js (App Router)</strong></summary>

```ts
// app/api/auth/otp/send/route.ts
import { NextResponse } from "next/server";
import { OtpyClient, OtpyError } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({ apiKey: process.env.OTPY_API_KEY! });

export async function POST(request: Request) {
  const { phone } = await request.json();
  try {
    return NextResponse.json(await otpy.sendOtp(phone));
  } catch (error) {
    if (error instanceof OtpyError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }
}
```

</details>

<details>
<summary><strong>SvelteKit</strong></summary>

```ts
// src/routes/auth/otp/send/+server.ts
import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { OtpyClient } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({ apiKey: env.OTPY_API_KEY! });

export async function POST({ request }) {
  const { phone } = await request.json();
  return json(await otpy.sendOtp(phone));
}
```

</details>

<details>
<summary><strong>Express</strong></summary>

```ts
import express from "express";
import { OtpyClient } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({ apiKey: process.env.OTPY_API_KEY! });
const app = express();
app.use(express.json());

app.post("/auth/otp/send", async (req, res) => {
  res.json(await otpy.sendOtp(req.body.phone));
});

app.post("/auth/otp/verify", async (req, res) => {
  const { phone, code } = req.body;
  res.json(await otpy.verifyOtp(phone, code));
});
```

</details>

<details>
<summary><strong>Bun / Deno / Cloudflare Workers</strong></summary>

The SDK uses only web-standard APIs, so it runs unchanged:

```ts
const otpy = new OtpyClient({ apiKey: Deno.env.get("OTPY_API_KEY")! });
const result = await otpy.sendOtp("09123456789");
```

</details>

> [!WARNING]
> **Never ship your API key to the browser.** The SDK runs in browsers, but an
> exposed key can spend your quota. Call OTPy from your server (or a route
> handler / edge function) and keep `OTPY_API_KEY` server-side only.

## 🤖 Works with your AI coding agent

The sibling [`@o-t-p-y/cli`](https://www.npmjs.com/package/@o-t-p-y/cli) ships an
`--ai` mode that prints framework-aware integration instructions as plain text —
ready to paste into any agent:

```bash
npx @o-t-p-y/cli init --ai
```

| Agent | How to use |
|---|---|
| **Claude Code** | Run `init --ai` and paste the output into the prompt. |
| **OpenAI Codex** | Run `init --ai` and include the output as context. |
| **Cursor** | Run `init --ai` and drop the output into the chat. |
| **GitHub Copilot** | Run `init --ai` and use the output in Copilot Chat. |
| **Windsurf** | Run `init --ai` and paste the output into Cascade. |
| **Gemini CLI / Cline / Aider** | Any agent that accepts text instructions works. |

## 🔗 Related

- [`@o-t-p-y/cli`](https://www.npmjs.com/package/@o-t-p-y/cli) — one-command integration wizard (`npx @o-t-p-y/cli init`).
- [`@o-t-p-y/mcp`](https://github.com/o-t-p-y/mcp) — MCP server for AI assistants.
- [OTPy.ir](https://otpy.ir) — product site, dashboard, and docs.

## 📄 License

MIT © [OTPy.ir](https://otpy.ir)