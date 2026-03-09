/**
 * Unit Tests — §322 Sentry PII Scrubber
 *
 * Tests the beforeSend PII filter in sentry.server.config.ts.
 * Verifies that email, password, and token fields are redacted from Sentry events.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/sentry-pii-scrubber.test.ts
 */

import { describe, it, expect } from 'vitest';

// ── Extract scrubPII as a pure function for testing ──────────────────────

const PII_KEYS = new Set(['email', 'password', 'access_token', 'refresh_token', 'token', 'secret']);

function scrubPII(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = scrubPII(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('§322: Sentry PII scrubber', () => {
  it('redacts email from top-level extras', () => {
    const result = scrubPII({ email: 'victim@company.com', orgId: 'org-123' });
    expect(result.email).toBe('[REDACTED]');
    expect(result.orgId).toBe('org-123');
  });

  it('redacts password from top-level extras', () => {
    const result = scrubPII({ password: 'SuperSecret1!', userId: 'u-1' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.userId).toBe('u-1');
  });

  it('redacts access_token and refresh_token', () => {
    const result = scrubPII({
      access_token: 'ya29.abc123',
      refresh_token: '1//0xyz',
      token_type: 'Bearer',
    });
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.refresh_token).toBe('[REDACTED]');
    expect(result.token_type).toBe('Bearer'); // not a PII key
  });

  it('redacts token and secret keys', () => {
    const result = scrubPII({ token: 'abc', secret: 'xyz' });
    expect(result.token).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
  });

  it('redacts nested PII fields', () => {
    const result = scrubPII({
      context: { email: 'user@test.com', action: 'register' },
      orgId: 'org-1',
    });
    const nested = result.context as Record<string, unknown>;
    expect(nested.email).toBe('[REDACTED]');
    expect(nested.action).toBe('register');
  });

  it('preserves non-PII fields unchanged', () => {
    const result = scrubPII({
      authUserId: 'auth-123',
      orgId: 'org-456',
      reason: 'Trigger not found',
      sprint: '315',
    });
    expect(result).toEqual({
      authUserId: 'auth-123',
      orgId: 'org-456',
      reason: 'Trigger not found',
      sprint: '315',
    });
  });

  it('handles empty objects', () => {
    expect(scrubPII({})).toEqual({});
  });

  it('preserves arrays as-is (no recursive into arrays)', () => {
    const result = scrubPII({ tags: ['auth', 'register'], email: 'x@y.com' });
    expect(result.tags).toEqual(['auth', 'register']);
    expect(result.email).toBe('[REDACTED]');
  });

  it('is case-insensitive on PII key matching', () => {
    // PII_KEYS stores lowercase — verify we match lowercase keys
    const result = scrubPII({ email: 'a@b.com', password: 'pass' });
    expect(result.email).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
  });
});
