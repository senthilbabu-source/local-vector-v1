/**
 * Unit Tests — Sentry Configuration
 *
 * Verifies Sentry is correctly configured:
 * - DSN is read from env
 * - Disabled in test environment
 * - Correct sample rates
 *
 * Run:
 *   npx vitest run src/__tests__/unit/sentry-config.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @sentry/nextjs to capture init() calls
// ---------------------------------------------------------------------------

const mockInit = vi.fn();
const mockCaptureException = vi.fn();
const mockReplayIntegration = vi.fn().mockReturnValue({ name: 'Replay' });
const mockCaptureRouterTransitionStart = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  init: mockInit,
  captureException: mockCaptureException,
  replayIntegration: mockReplayIntegration,
  captureRouterTransitionStart: mockCaptureRouterTransitionStart,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sentry configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('instrumentation-client calls Sentry.init with DSN from env', async () => {
    const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc@o123.ingest.sentry.io/456';

    try {
      await import('@/instrumentation-client');

      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://abc@o123.ingest.sentry.io/456',
        })
      );
    } finally {
      if (savedDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      else process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
    }
  });

  it('Sentry is disabled when NEXT_PUBLIC_SENTRY_DSN is empty', async () => {
    const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    try {
      await import('@/instrumentation-client');

      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    } finally {
      if (savedDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      else process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
    }
  });

  it('Sentry is enabled when NEXT_PUBLIC_SENTRY_DSN is set', async () => {
    const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc@sentry.io/123';

    try {
      await import('@/instrumentation-client');

      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    } finally {
      if (savedDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      else process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
    }
  });

  it('tracesSampleRate is set to 0.1 (10% sampling)', async () => {
    const savedDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://abc@sentry.io/123';

    try {
      await import('@/instrumentation-client');

      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.1,
        })
      );
    } finally {
      if (savedDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      else process.env.NEXT_PUBLIC_SENTRY_DSN = savedDsn;
    }
  });
});
