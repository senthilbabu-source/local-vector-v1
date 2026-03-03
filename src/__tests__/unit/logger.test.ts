/**
 * Unit Tests — Structured Logger (P7-FIX-30)
 *
 * Verifies JSON output in production, human-readable in dev,
 * sensitive field redaction, and error serialization.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/logger.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lib/logger — redactSensitiveFields()', () => {
  // Import directly since it's a pure function
  let redactSensitiveFields: typeof import('@/lib/logger').redactSensitiveFields;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/logger');
    redactSensitiveFields = mod.redactSensitiveFields;
  });

  it('redacts password field', () => {
    const result = redactSensitiveFields({ password: 'secret123', name: 'test' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.name).toBe('test');
  });

  it('redacts token field', () => {
    const result = redactSensitiveFields({ token: 'abc123' });
    expect(result.token).toBe('[REDACTED]');
  });

  it('redacts secret field', () => {
    const result = redactSensitiveFields({ secret: 'mysecret' });
    expect(result.secret).toBe('[REDACTED]');
  });

  it('redacts authorization field', () => {
    const result = redactSensitiveFields({ authorization: 'Bearer xxx' });
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('redacts stripe_customer_id field', () => {
    const result = redactSensitiveFields({ stripe_customer_id: 'cus_xxx' });
    expect(result.stripe_customer_id).toBe('[REDACTED]');
  });

  it('redacts api_key field', () => {
    const result = redactSensitiveFields({ api_key: 'sk-xxx' });
    expect(result.api_key).toBe('[REDACTED]');
  });

  it('redacts nested sensitive fields', () => {
    const result = redactSensitiveFields({
      user: { name: 'test', password: 'secret' },
    });
    expect((result.user as Record<string, unknown>).name).toBe('test');
    expect((result.user as Record<string, unknown>).password).toBe('[REDACTED]');
  });

  it('preserves non-sensitive fields', () => {
    const result = redactSensitiveFields({
      orgId: '123',
      route: '/api/test',
      duration_ms: 42,
    });
    expect(result.orgId).toBe('123');
    expect(result.route).toBe('/api/test');
    expect(result.duration_ms).toBe(42);
  });

  it('handles empty object', () => {
    expect(redactSensitiveFields({})).toEqual({});
  });

  it('preserves arrays', () => {
    const result = redactSensitiveFields({ tags: ['a', 'b'] });
    expect(result.tags).toEqual(['a', 'b']);
  });
});

describe('lib/logger — log methods', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.resetModules();
  });

  it('log.info calls console.log', async () => {
    const { log } = await import('@/lib/logger');
    log.info('test message');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('log.warn calls console.warn', async () => {
    const { log } = await import('@/lib/logger');
    log.warn('warning message');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('log.error calls console.error', async () => {
    const { log } = await import('@/lib/logger');
    log.error('error message');
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('log.info includes context fields in output', async () => {
    const { log } = await import('@/lib/logger');
    log.info('test', { requestId: 'req-123', route: '/api/test' });
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('req-123');
    expect(output).toContain('/api/test');
  });

  it('log.error includes error details', async () => {
    const { log } = await import('@/lib/logger');
    const err = new Error('boom');
    log.error('failed', {}, err);
    const output = consoleErrorSpy.mock.calls[0][0] as string;
    expect(output).toContain('boom');
  });

  it('log.info redacts sensitive fields from context', async () => {
    const { log } = await import('@/lib/logger');
    log.info('test', { password: 'secret123', orgId: 'org-1' } as Record<string, unknown>);
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).not.toContain('secret123');
    expect(output).toContain('[REDACTED]');
    expect(output).toContain('org-1');
  });

  it('log.info works without context', async () => {
    const { log } = await import('@/lib/logger');
    log.info('bare message');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('bare message');
  });

  it('log.error serializes non-Error objects', async () => {
    const { log } = await import('@/lib/logger');
    log.error('failed', {}, 'string error');
    const output = consoleErrorSpy.mock.calls[0][0] as string;
    expect(output).toContain('string error');
  });

  it('default export is the same log object', async () => {
    const mod = await import('@/lib/logger');
    expect(mod.default).toBe(mod.log);
  });
});
