// Terminal output helpers. Zero runtime deps (AGENTS.md hard rule).
//
// Stream convention: progress (spinner) goes to stderr, data and results go to
// stdout. That keeps `otpy-cli init | tee log` clean in every mode and lets the
// no-`\r` / no-ANSI test invariants hold on both streams.

export const BANNER_TEXT = `
┌──────────────────────────────────────────────────────┐
│  OTPy.ir - Smart OTP SMS (Iran)                      │
│  Fast, affordable. No contracts, no dedicated line.  │
└──────────────────────────────────────────────────────┘
`;

// U+28xx braille — exactly ten frames. Do not substitute look-alike U+29xx
// glyphs; the ui test pins the code-point range to catch copy-paste drift.
export const BRAILLE_FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
export const ASCII_FRAMES = "|/-\\";

export function printBanner(): void {
  console.log(BANNER_TEXT);
}

/**
 * True only for a real terminal that can animate safely. `OTPY_NO_SPINNER=1`
 * is the explicit escape hatch for PTY-wrapping agent harnesses where isTTY is
 * true but frames would pollute captured transcripts.
 */
export function isInteractive(): boolean {
  return (
    Boolean(process.stderr.isTTY) &&
    process.env.TERM !== "dumb" &&
    !process.env.CI &&
    !process.env.OTPY_NO_SPINNER
  );
}

function spinnerFrames(): string[] {
  // Legacy Windows conhost raster fonts lack braille / VT processing.
  const legacyWindows =
    process.platform === "win32" && !process.env.WT_SESSION && !process.env.TERM_PROGRAM;
  return (legacyWindows ? ASCII_FRAMES : BRAILLE_FRAMES).split("");
}

export interface Spinner {
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}

/**
 * Start a spinner. Non-interactive environments (pipes, CI, AI-agent TUIs)
 * degrade to one static stderr line with no frames, `\r`, or ANSI.
 */
export function spinner(text: string): Spinner {
  const stream = process.stderr;

  if (!isInteractive()) {
    stream.write(`${text}\n`);
    let finished = false;
    const finish = (final: string) => {
      if (finished) return;
      finished = true;
      stream.write(`${final}\n`);
    };
    return {
      succeed(final) {
        finish(final ?? text);
      },
      fail(final) {
        finish(final ?? text);
      },
      stop() {
        finished = true;
      },
    };
  }

  const frames = spinnerFrames();
  const maxWidth = Math.max(0, (stream.columns ?? 80) - 4);
  const render = (line: string) => stream.write(`\r${line.slice(0, maxWidth)}`);
  const clear = () => stream.write("\r\x1b[K");

  let frameIndex = 0;
  render(`${frames[0]} ${text}`);
  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    render(`${frames[frameIndex]} ${text}`);
  }, 80);
  // Safe: a pending fetch holds its own libuv handle, so unref only means the
  // timer alone never keeps the process alive.
  interval.unref();

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    process.removeListener("SIGINT", onSigint);
    clear();
  };
  const onSigint = () => {
    stop();
    process.exit(130);
  };
  process.once("SIGINT", onSigint);

  const finish = (final: string) => {
    if (stopped) return;
    stop();
    stream.write(`${final}\n`);
  };

  return {
    succeed(final) {
      finish(final ?? text);
    },
    fail(final) {
      finish(final ?? text);
    },
    stop,
  };
}
