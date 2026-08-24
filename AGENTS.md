# AGENTS.md — packages/sdk-ts (npm: `otpy`)

Public TypeScript SDK. ZERO runtime dependencies — do not add any.

- Mirrors the public API surface exactly: sendOtp / verifyOtp (boolean-only
  verdict) / usage. Errors surface as `OtpyError { status, code }`.
- Works in Node 18+ and browsers (fetch + AbortController only).
- Client-side validation before network (phone regex `^09\d{9}$`).
- Every behavior change needs a test with mocked fetch (see index.test.ts).
- Published from the repo root release flow; version is the monorepo version.
