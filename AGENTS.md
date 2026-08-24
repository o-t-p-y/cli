# AGENTS.md — cli/otpy

`npx otpy init` — integration wizard (P4): framework detection → code patch →
open PR (GitHub) / print instructions; `--ai` mode emits agent skill bundles.

- Keep zero heavy deps; the CLI must install in seconds on slow networks.
- Detect stacks by marker files (package.json deps, composer.json, go.mod…).
- Never write secrets into generated code — inject `OTPY_API_KEY` env reference.
- Same design voice as the product: Persian prompts, monochrome terminal output.
