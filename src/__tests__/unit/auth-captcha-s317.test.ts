/**
 * Unit Tests — §317 Cloudflare Turnstile CAPTCHA (Pure Functions)
 *
 * Tests server-side token verification: lib/auth/turnstile.ts
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-captcha-s317.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTurnstileEnabled,
  verifyTurnstileToken,
} from '@/lib/auth/turnstile';

describe('§317: Turnstile verification (lib/auth/turnstile.ts)', () => {
  let originalEnv: string | undefined;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    originalEnv = process.env.TURNSTILE_SECRET_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TURNSTILE_SECRET_KEY = originalEnv;
    } else {
      delete process.env.TURNSTILE_SECRET_KEY;
    }
    globalThis.fetch = originalFetch;
  });

  describe('isTurnstileEnabled()', () => {
    it('returns false when TURNSTILE_SECRET_KEY is not set', () => {
      delete process.env.TURNSTILE_SECRET_KEY;
      expect(isTurnstileEnabled()).toBe(false);
    });

    it('returns true when TURNSTILE_SECRET_KEY is set', () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
      expect(isTurnstileEnabled()).toBe(true);
    });

    it('returns false for empty string secret key', () => {
      process.env.TURNSTILE_SECRET_KEY = '';
      expect(isTurnstileEnabled()).toBe(false);
    });
  });

  describe('verifyTurnstileToken()', () => {
    it('returns success when no secret key is set (fail-open)', async () => {
      delete process.env.TURNSTILE_SECRET_KEY;
      const result = await verifyTurnstileToken('any-token');
      expect(result.success).toBe(true);
      expect(result.error_codes).toEqual([]);
    });

    it('returns failure for empty token when secret key is set', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      const result = await verifyTurnstileToken('');
      expect(result.success).toBe(false);
      expect(result.error_codes).toContain('missing-input-response');
    });

    it('returns failure for whitespace-only token when secret key is set', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      const result = await verifyTurnstileToken('   ');
      expect(result.success).toBe(false);
      expect(result.error_codes).toContain('missing-input-response');
    });

    it('returns success when Cloudflare API returns success', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            challenge_ts: '2026-03-08T00:00:00Z',
            hostname: 'localhost',
            'error-codes': [],
          }),
      });
      globalThis.fetch = mockFetch;

      const result = await verifyTurnstileToken('valid-token', '127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.challenge_ts).toBe('2026-03-08T00:00:00Z');
      expect(result.hostname).toBe('localhost');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      expect(options.method).toBe('POST');
      expect(options.body).toContain('secret=test-secret');
      expect(options.body).toContain('response=valid-token');
      expect(options.body).toContain('remoteip=127.0.0.1');
    });

    it('returns failure when Cloudflare API returns failure', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: false,
            'error-codes': ['invalid-input-response'],
          }),
      });

      const result = await verifyTurnstileToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error_codes).toContain('invalid-input-response');
    });

    it('returns failure with HTTP error code when Cloudflare API returns non-OK', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await verifyTurnstileToken('some-token');

      expect(result.success).toBe(false);
      expect(result.error_codes).toContain('http-error-503');
    });

    it('fails open on network error (returns success)', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await verifyTurnstileToken('some-token');

      expect(result.success).toBe(true);
      expect(result.error_codes).toContain('network-error-failopen');
    });

    it('omits remoteip when ip is not provided', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, 'error-codes': [] }),
      });
      globalThis.fetch = mockFetch;

      await verifyTurnstileToken('valid-token');

      const body = mockFetch.mock.calls[0][1].body as string;
      expect(body).not.toContain('remoteip');
    });
  });
});
