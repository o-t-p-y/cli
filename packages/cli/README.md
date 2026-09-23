# @o-t-p-y/cli

The official CLI and automatic integration wizard for [OTPy.ir](https://otpy.ir).

## Quick Start

Initialize OTP authentication in your existing project with one command:

```bash
npx @o-t-p-y/cli init
```

The CLI will:
1. Detect your framework (Next.js App/Pages router, SvelteKit, Express, Python FastAPI/Django, Go, PHP Laravel).
2. Ask for or detect your `OTPY_API_KEY` and safely update your `.env` or `.env.local`.
3. Generate ready-to-run client and route handler files.

The supplied key is checked against `GET /v1/usage`; an unavailable or rejected check prints a warning and the wizard continues. If no supported framework is detected, the wizard prints the REST integration guide and does not create framework files.

The CLI works with any code stack. Hybrid repos are detected by their non-JS markers (`requirements.txt`/`pyproject.toml`, `composer.json`, `go.mod`) even when a bare `package.json` is present, so mixed stacks get REST instructions instead of JavaScript files. Django projects get a framework-neutral REST client (`otpy_client.py`) rather than the FastAPI router.

## Other Commands

### Send a Test OTP

```bash
npx @o-t-p-y/cli test 09123456789
```

### View Daily Quota Usage

```bash
npx @o-t-p-y/cli usage
```

### AI Integration Mode

```bash
npx @o-t-p-y/cli init --ai
```

Outputs prompt instructions for AI coding assistants (Cursor, Windsurf, Claude Code, GitHub Copilot). The instructions are framework-aware: JavaScript projects get `@o-t-p-y/sdk` guidance, while Python, Go, PHP, and unknown projects get REST API instructions.

## License

MIT © [OTPy.ir](https://otpy.ir)
