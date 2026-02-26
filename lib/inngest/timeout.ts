// ---------------------------------------------------------------------------
// lib/inngest/timeout.ts — Step timeout guard
//
// Wraps an async operation with a 55-second timeout using Promise.race.
// Vercel Pro allows 60s per step invocation; 55s gives a 5s buffer for
// Inngest overhead (serialisation, step bookkeeping).
//
// Usage:
//   await step.run('my-step', () => withTimeout(() => doWork()));
// ---------------------------------------------------------------------------

const STEP_TIMEOUT_MS = 55_000;

export function withTimeout<T>(fn: () => Promise<T>, timeoutMs = STEP_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Step timeout: ${timeoutMs / 1000}s`)), timeoutMs),
    ),
  ]);
}
