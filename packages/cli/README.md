<div align="center">

# 🛠️ OTPy CLI

**One command to add phone-login OTP to any codebase — in any stack.**

[![npm version](https://img.shields.io/npm/v/@o-t-p-y/cli?style=flat-square&color=000000&label=npm)](https://www.npmjs.com/package/@o-t-p-y/cli)
[![npm downloads](https://img.shields.io/npm/dm/@o-t-p-y/cli?style=flat-square&color=000000)](https://www.npmjs.com/package/@o-t-p-y/cli)
[![CI](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/o-t-p-y/cli/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@o-t-p-y/cli?style=flat-square&color=000000)](https://github.com/o-t-p-y/cli/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@o-t-p-y/cli?style=flat-square&color=000000)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-0-000000?style=flat-square)](#-commands)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![Codex](https://img.shields.io/badge/Codex-compatible-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![Cursor](https://img.shields.io/badge/Cursor-ready-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![GitHub Copilot](https://img.shields.io/badge/GitHub%20Copilot-ready-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)
[![Windsurf](https://img.shields.io/badge/Windsurf-ready-000000?style=flat-square)](https://github.com/o-t-p-y/cli#works-with-your-ai-coding-agent)

**Detects your stack · Writes the files · Wires your env · English-only TUI**

[Product](https://otpy.ir) · [Dashboard](https://dash.otpy.ir) · [Docs](https://otpy.ir/docs) · [Issues](https://github.com/o-t-p-y/cli/issues)

</div>

---

## 🚀 Quick Start

Run the wizard inside your project. It detects your framework, logs you in through
your browser (no copy-pasting keys), generates ready-to-run client + route handlers,
and wires `OTPY_API_KEY` into your env file:

```bash
npx @o-t-p-y/cli init
```

No config files. No global install. Nothing to remember.

## 🤔 What `init` actually does

1. 🔍 **Detects your framework** and TypeScript setup from the files in your project.
2. 🔑 **Gets an API key**: `--api-key`, an existing `OTPY_API_KEY` in your env file or
   environment, or a **browser login**: the CLI shows a short code, opens
   `dash.otpy.ir/cli`, you check the code and approve, and a fresh key lands in your env file.
   Prefer pasting? Paste it at the prompt (input is masked) or use `--paste`.
3. ✅ **Validates pasted keys** against `GET /v1/usage`: a key the API rejects is not saved;
   if the API is unreachable it is saved with a warning.
4. 🗂️ **Generates integration files** for your stack, skipping anything that already exists.
5. 🙈 **Protects your secrets** by adding the env file to `.gitignore` if it is not already ignored.
6. 🎉 **Prints next steps** tailored to what it detected.

> **Works with any code stack.** Unsupported or hybrid projects still get a complete
> REST integration guide (cURL examples included) — the wizard never leaves you empty-handed.

## 🧰 Supported Frameworks

| Stack | Detected by | Generated files |
|---|---|---|
| **Next.js (App Router)** | `next` + `app/` | `lib/otpy.*`, `app/api/auth/otp/{send,verify}/route.*` |
| **Next.js (Pages Router)** | `next` + `pages/` | `lib/otpy.*`, `pages/api/auth/otp/{send,verify}.*` |
| **SvelteKit** | `@sveltejs/kit` | `src/lib/otpy.ts`, `src/routes/auth/otp/{send,verify}/+server.ts` |
| **Express / Fastify / Koa / Hono** | JS server dep | `lib/otpy.*`, `routes/otp.*` |
| **Node (generic)** | bare `package.json` | `lib/otpy.*`, `routes/otp.*` |
| **Python (FastAPI)** | `pyproject.toml` / `requirements.txt` | `routers/otp.py` |
| **Python (Django)** | `manage.py` | `otpy_client.py` (framework-neutral REST client) |
| **Go** | `go.mod` | `pkg/otpy/client.go` |
| **PHP (Laravel)** | `composer.json` + `artisan` | `config/otpy.php`, `app/Http/Controllers/OtpController.php`, `routes/api.php` |
| **Anything else** | — | Printed REST + cURL guide (no files touched) |

Hybrid repos (for example `package.json` + `requirements.txt`) are detected by their
non-JS markers, so mixed stacks get REST instructions instead of JavaScript files.

## 🧭 Commands

| Command | What it does |
|---|---|
| `npx @o-t-p-y/cli init` | Detect the stack, log in, and scaffold an integration. |
| `npx @o-t-p-y/cli login` | Browser login only: save a new API key to the env file. |
| `npx @o-t-p-y/cli init --mcp [cursor\|claude\|windsurf\|kilo]` | Also set up the OTPy MCP server (writes `.cursor/mcp.json` for Cursor, prints the block for others). |
| `npx @o-t-p-y/cli init --api-key <key>` | Non-interactive init with a supplied key. |
| `npx @o-t-p-y/cli init --no-browser` | Print the login link instead of opening a browser (SSH, servers). |
| `npx @o-t-p-y/cli init --ai` | Also print AI-assistant integration instructions. |
| `npx @o-t-p-y/cli test 09123456789` | Send a real test OTP and check billing. |
| `npx @o-t-p-y/cli usage` | Show today's free/paid quota and daily limit. |
| `npx @o-t-p-y/cli --version` | Print the CLI version. |
| `npx @o-t-p-y/cli --help` | Print usage. |

### Send a test OTP

```bash
npx @o-t-p-y/cli test 09123456789
```

```text
✅ SMS sent!
   Request ID: req_...
   Billing: daily free quota
```

### Check daily usage

```bash
npx @o-t-p-y/cli usage
```

```text
📊 Today's usage:
   Free quota used: 4 of 100
   Paid SMS: 0
   Daily limit: 100
```

## 🤖 Works with your AI coding agent

`init --ai` emits framework-aware, plain-text instructions for your coding agent.
JavaScript stacks get `@o-t-p-y/sdk` guidance; Python, Go, PHP, and unknown stacks
get REST instructions.

```bash
npx @o-t-p-y/cli init --ai
```

```text
🤖 AI assistant instructions (Claude Code / Codex / Cursor / Windsurf / Copilot):
   - Library: @o-t-p-y/sdk
   - Send: otpy.sendOtp(phone) -> { request_id, ttl_seconds }
   - Verify: otpy.verifyOtp(phone, code) -> { verified: true }
```

| Agent | How to use |
|---|---|
| **Claude Code** | Paste the `--ai` output into the prompt. |
| **OpenAI Codex** | Include the `--ai` output as context. |
| **Cursor** | Drop the output into the chat. |
| **GitHub Copilot** | Use the output in Copilot Chat. |
| **Windsurf** | Paste the output into Cascade. |
| **Gemini CLI / Cline / Aider** | Any agent that accepts text instructions works. |

## 🎛️ Behavior & Exit Codes

- ✅ **Non-destructive** — existing files are skipped, never overwritten.
- 🙈 **Secret-safe** — the env file is git-ignored; keys are never printed.
- 🌐 **English-only output** — the terminal stays readable in every locale (`OTPY_NO_SPINNER=1` disables animation).
- 🤖 **Never hangs in CI or agents** — without a TTY, `init` skips the key prompt and tells you how to provide one; `login` still works anywhere (it prints the link).
- 🧯 **Exit `1`** on any failure: invalid phone, missing or rejected key, API/network errors (with a one-line next step such as the top-up link), denied or expired login, or an unknown command.
- 🌍 **`OTPY_BASE_URL`** overrides the API host for every command.

## 🔗 Related

- [`@o-t-p-y/sdk`](https://www.npmjs.com/package/@o-t-p-y/sdk) — the zero-dependency TypeScript SDK.
- [`@o-t-p-y/mcp`](https://github.com/o-t-p-y/mcp) — MCP server for AI assistants.
- [OTPy.ir](https://otpy.ir) — product site, dashboard, and docs.

## 📄 License

MIT © [OTPy.ir](https://otpy.ir)