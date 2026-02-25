import { describe, it, expect } from 'vitest';

describe('lib/ai/providers', () => {
  it('exports all provider instances', async () => {
    const mod = await import('@/lib/ai/providers');
    expect(mod.openai).toBeDefined();
    expect(mod.perplexity).toBeDefined();
    expect(mod.anthropic).toBeDefined();
    expect(mod.google).toBeDefined();
  });

  it('registers truth-audit model keys', async () => {
    const { MODELS } = await import('@/lib/ai/providers');
    expect(MODELS['truth-audit-anthropic']).toBeDefined();
    expect(MODELS['truth-audit-gemini']).toBeDefined();
    expect(MODELS['truth-audit-openai']).toBeDefined();
    expect(MODELS['truth-audit-perplexity']).toBeDefined();
  });

  it('getModel returns a model for each truth-audit key', async () => {
    const { getModel } = await import('@/lib/ai/providers');
    const keys = [
      'truth-audit-anthropic',
      'truth-audit-gemini',
      'truth-audit-openai',
      'truth-audit-perplexity',
    ] as const;
    for (const key of keys) {
      const model = getModel(key);
      expect(model).toBeDefined();
      expect(model.modelId).toBeTruthy();
    }
  });

  it('getModel throws for unknown keys', async () => {
    const { getModel } = await import('@/lib/ai/providers');
    expect(() => getModel('nonexistent' as any)).toThrow(
      '[ai/providers] Unknown model key: nonexistent',
    );
  });

  it('hasApiKey returns boolean for all supported providers', async () => {
    const { hasApiKey } = await import('@/lib/ai/providers');
    expect(typeof hasApiKey('openai')).toBe('boolean');
    expect(typeof hasApiKey('perplexity')).toBe('boolean');
    expect(typeof hasApiKey('anthropic')).toBe('boolean');
    expect(typeof hasApiKey('google')).toBe('boolean');
  });
});
