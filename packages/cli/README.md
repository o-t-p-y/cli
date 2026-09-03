# otpy-cli

The official CLI and automatic integration wizard for [OTPy.ir](https://otpy.ir).

## Quick Start

Initialize OTP authentication in your existing project with one command:

```bash
npx otpy-cli init
```

The CLI will:
1. Detect your framework (Next.js App/Pages router, SvelteKit, Express, Python FastAPI/Django, Go, PHP Laravel).
2. Ask for or detect your `OTPY_API_KEY` and safely update your `.env` or `.env.local`.
3. Generate ready-to-run client and route handler files.

## Other Commands

### Send a Test OTP

```bash
npx otpy-cli test 09123456789
```

### View Daily Quota Usage

```bash
npx otpy-cli usage
```

### AI Integration Mode

```bash
npx otpy-cli init --ai
```

Outputs prompt instructions for AI coding assistants (Cursor, Windsurf, Claude Code, GitHub Copilot).

## License

MIT © [OTPy.ir](https://otpy.ir)
