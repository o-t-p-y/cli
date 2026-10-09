# AGENTS.md — cli/otpy

`npx @o-t-p-y/cli init` — integration wizard: framework detection → API key (browser
device login against `/v1/cli/device*`, or `--api-key`/paste) → code generation → next
steps; `--mcp` wires the MCP server; `--ai` prints agent instructions.

- Keep zero heavy deps; the CLI must install in seconds on slow networks.
- Detect stacks by marker files (package.json deps, composer.json, go.mod…).
- Never write secrets into generated code — inject `OTPY_API_KEY` env reference.
- Terminal output in English only (LTR-safe for every terminal and AI-agent TUI); emojis + monochrome stderr spinner, zero runtime deps. Persian lives only in generated end-user error strings (templates.ts — never print template contents to the terminal).
- Never block without a TTY: no prompts when stdin is not interactive (CI, AI agents).
- Failures exit 1 with one actionable English line (src/errors.ts maps API error codes).
