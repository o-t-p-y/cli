# otpy

Official zero-dependency TypeScript/JavaScript SDK for [OTPy.ir](https://otpy.ir) — send and verify login OTPs in seconds.

## Features

- **Zero dependencies**: Built with native `fetch` and `AbortController`.
- **Full TypeScript support**: Complete type definitions out of the box.
- **Node & Browser compatible**: Works seamlessly on Node.js 18+, Bun, Deno, Next.js, Cloudflare Workers, and browsers.
- **Pre-network phone validation**: Validates Iranian phone formats (`09xxxxxxxxx`) before making any HTTP request.

## Installation

```bash
npm install @o-t-p-y/sdk
# or
pnpm add otpy
# or
yarn add otpy
```

## Quick Start

### 1. Initialize the Client

```typescript
import { OtpyClient } from "@o-t-p-y/sdk";

const otpy = new OtpyClient({
  apiKey: process.env.OTPY_API_KEY!,
});
```

### 2. Send an OTP

```typescript
const { request_id, ttl_seconds, free } = await otpy.sendOtp("09123456789");
console.log(`OTP sent! Request ID: ${request_id}, Free quota: ${free}`);
```

### 3. Verify the OTP

```typescript
const { verified } = await otpy.verifyOtp("09123456789", "123456");

if (verified) {
  console.log("Authentication successful!");
} else {
  console.log("Invalid or expired code.");
}
```

### 4. Check Daily Usage

```typescript
const usage = await otpy.usage();
console.log(`Free used today: ${usage.free_used_today} / ${usage.free_quota_today}`);
console.log(`Paid sent today: ${usage.paid_today}`);
```

## Error Handling

```typescript
import { OtpyClient, OtpyError } from "@o-t-p-y/sdk";

try {
  await otpy.sendOtp("09123456789");
} catch (error) {
  if (error instanceof OtpyError) {
    console.error(`Error ${error.code} (HTTP ${error.status}): ${error.message}`);
  }
}
```

## License

MIT © [OTPy.ir](https://otpy.ir)
