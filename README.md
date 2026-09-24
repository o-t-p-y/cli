<div align="center">

# 🇮🇷 OTPy CLI & SDK

**Official JavaScript/TypeScript tooling for [OTPy.ir](https://otpy.ir) — Iranian OTP delivery over SMS.**

[![CI](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@o-t-p-y/sdk?style=flat-square&color=000000)](https://github.com/o-t-p-y/cli/blob/main/LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-000000?style=flat-square)](https://github.com/o-t-p-y/cli/pulls)

[![sdk npm](https://img.shields.io/npm/v/@o-t-p-y/sdk?style=flat-square&color=000000&label=sdk)](https://www.npmjs.com/package/@o-t-p-y/sdk)
[![cli npm](https://img.shields.io/npm/v/@o-t-p-y/cli?style=flat-square&color=000000&label=cli)](https://www.npmjs.com/package/@o-t-p-y/cli)
[![sdk downloads](https://img.shields.io/npm/dm/@o-t-p-y/sdk?style=flat-square&color=000000&label=sdk%20downloads)](https://www.npmjs.com/package/@o-t-p-y/sdk)
[![cli downloads](https://img.shields.io/npm/dm/@o-t-p-y/cli?style=flat-square&color=000000&label=cli%20downloads)](https://www.npmjs.com/package/@o-t-p-y/cli)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-000000?style=flat-square)](#works-with-your-ai-coding-agent)
[![Codex](https://img.shields.io/badge/Codex-compatible-000000?style=flat-square)](#works-with-your-ai-coding-agent)
[![Cursor](https://img.shields.io/badge/Cursor-ready-000000?style=flat-square)](#works-with-your-ai-coding-agent)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-ready-000000?style=flat-square)](#works-with-your-ai-coding-agent)
[![Windsurf](https://img.shields.io/badge/Windsurf-ready-000000?style=flat-square)](#works-with-your-ai-coding-agent)

[Product](https://otpy.ir) · [Dashboard](https://dash.otpy.ir) · [Docs](https://otpy.ir/docs) · [MCP](https://github.com/o-t-p-y/mcp)

</div>

---

This repository is a pnpm workspace that publishes two packages independently.

| Package | npm | What it is |
|---|---|---|
| [`@o-t-p-y/sdk`](packages/otpy) | `npm install @o-t-p-y/sdk` | 🪶 Zero-dependency TypeScript SDK — send and verify login OTPs. |
| [`@o-t-p-y/cli`](packages/cli) | `npx @o-t-p-y/cli init` | 🛠️ One-command integration wizard — detects your framework and generates ready-to-run OTP routes. |

## 🚀 Quick Start

**Use the SDK directly:**

```bash
npm install @o-t-p-y/sdk
```

```ts
import { OtpyClient } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({ apiKey: process.env.OTPY_API_KEY! });
const { request_id } = await otpy.sendOtp("09123456789");
const { verified } = await otpy.verifyOtp("09123456789", "123456");
```

**Or scaffold a full integration:**

```bash
npx @o-t-p-y/cli init
```

The wizard detects Next.js (App/Pages Router), SvelteKit, Express, Fastify/Koa/Hono,
Python FastAPI/Django, Go, and PHP Laravel, then generates client + route handler
files and wires your `OTPY_API_KEY` into `.env`. Unsupported stacks get a REST guide.

## 📦 Packages

- **[`packages/otpy`](packages/otpy/README.md)** — the SDK. Zero runtime dependencies; works in Node 18+, Bun, Deno, Next.js, Cloudflare Workers, and browsers. Validates Iranian phone format (`09xxxxxxxxx`) before any network call.
- **[`packages/cli`](packages/cli/README.md)** — the wizard. Ships the `otpy-cli` bin and also supports `test`, `usage`, and `--ai` (agent integration instructions).

## 🤖 Works with your AI coding agent

Both packages are agent-friendly:

```bash
npx @o-t-p-y/cli init --ai
```

emits plain-text, framework-aware instructions for **Claude Code**, **OpenAI Codex**,
**Cursor**, **GitHub Copilot**, **Windsurf**, **Gemini CLI**, and any other assistant
that accepts text context.

## 🗂️ Repository Layout

```
packages/otpy   @o-t-p-y/sdk  (published)
packages/cli    @o-t-p-y/cli  (published)
```

## 🧪 Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

CI runs all four on every push and pull request.

## 🔖 Versioning & Releases

Each package versions independently. Releases are tag-triggered through GitHub
Actions with npm provenance (`--provenance`):

| Tag | Publishes |
|---|---|
| `sdk@x.y.z` | `@o-t-p-y/sdk` |
| `cli@x.y.z` | `@o-t-p-y/cli` |

The tag version must match the package's `package.json` version.

## 🔗 Related

- [`@o-t-p-y/mcp`](https://github.com/o-t-p-y/mcp) — Model Context Protocol server for AI assistants (balance, API-key management, integration snippets).
- [OTPy.ir](https://otpy.ir) — product site and dashboard.

## 📄 License

MIT © [OTPy.ir](https://otpy.ir)