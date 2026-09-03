# OTPy CLI & SDK

Official JavaScript/TypeScript tooling for [OTPy.ir](https://otpy.ir) — Iranian OTP (one-time password) delivery over SMS.

This repository is a pnpm workspace with two published packages:

| Package | npm | What it is |
|---|---|---|
| [`@o-t-p-y/sdk`](packages/otpy) | `npm install @o-t-p-y/sdk` | Zero-dependency TypeScript SDK — send and verify login OTPs |
| [`@o-t-p-y/cli`](packages/cli) | `npx @o-t-p-y/cli init` | One-command integration wizard — detects your framework and generates ready-to-run OTP routes |

## Quick start

**Use the SDK directly:**

```bash
npm install @o-t-p-y/sdk
```

```typescript
import { OtpyClient } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({ apiKey: process.env.OTPY_API_KEY! });
const { request_id } = await otpy.sendOtp("09123456789");
const { verified } = await otpy.verifyOtp("09123456789", "123456");
```

**Or scaffold a full integration:**

```bash
npx @o-t-p-y/cli init
```

The wizard detects Next.js (App/Pages Router), SvelteKit, Express, Python FastAPI/Django, Go, and PHP Laravel, then generates client + route handler files and wires your `OTPY_API_KEY` into `.env`.

## Packages

- **[`packages/otpy`](packages/otpy/README.md)** — the SDK. Zero runtime dependencies, works in Node 18+, Bun, Deno, Next.js, Cloudflare Workers, and browsers. Validates Iranian phone format (`09xxxxxxxxx`) before any network call.
- **[`packages/cli`](packages/cli/README.md)** — the wizard. Ships as the `otpy-cli` bin; also supports `test` (send a test OTP), `usage` (daily quota), and `--ai` (agent integration instructions).

## Related

- [`@o-t-p-y/mcp`](https://github.com/o-t-p-y/mcp) — Model Context Protocol server for AI assistants (balance, API-key management, integration snippets).
- [OTPy.ir](https://otpy.ir) — product site and dashboard.

## Versioning & releases

Each package versions independently. Releases are tag-triggered through GitHub Actions with npm provenance (`--provenance`):

- `sdk@x.y.z` → publishes `@o-t-p-y/sdk`
- `cli@x.y.z` → publishes `@o-t-p-y/cli`

## License

MIT © [OTPy.ir](https://otpy.ir)
