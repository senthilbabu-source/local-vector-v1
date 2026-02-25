# Claude Code Prompt #2 — AI SDK Provider Installation: @ai-sdk/anthropic + @ai-sdk/google

## Context

You are working on the **LocalVector.ai** codebase at `local-vector-v1/`. This is a Next.js 16.1.6 app with React 19.2.3, Tailwind CSS 4.2.0, Vercel AI SDK (`ai@^4.3.16`), and `@ai-sdk/openai@^1.3.22`. Read `docs/AI_RULES.md` before making any changes.

The codebase currently only queries **OpenAI** (GPT-4o, GPT-4o-mini) and **Perplexity** (Sonar, via OpenAI-compatible API). Feature #2 (Multi-Engine AI Truth Audit) requires querying **Google Gemini** and **Anthropic Claude** to provide per-engine AI visibility comparison.

All AI provider configuration is centralized in `lib/ai/providers.ts`. This is the **only file that should be modified** in this task.

## Step 1 — Install packages

```bash
npm install @ai-sdk/anthropic @ai-sdk/google
```

**Expected result:** Both packages install alongside existing `@ai-sdk/openai@^1.3.22` and `ai@^4.3.16`. npm will resolve `@ai-sdk/provider@3.x` and `@ai-sdk/provider-utils@4.x` as nested dependencies under the new packages, while the existing `@ai-sdk/provider@1.x` continues to serve `@ai-sdk/openai` and `ai`. This is safe — npm handles dual-version nesting automatically.

## Step 2 — Verify build integrity

```bash
npm run build
npm run test
```

If either fails, STOP and report the error. Do NOT modify any existing code to fix it.

## Step 3 — Update `lib/ai/providers.ts`

This is the **only existing file you will edit**. Make these specific changes:

### 3a — Add imports

Add two new import statements after the existing `createOpenAI` import:

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
```

### 3b — Add provider instances

Add two new provider instances after the existing `perplexity` provider. Follow the exact comment style and JSDoc pattern already used in the file:

```typescript
/**
 * Anthropic provider — used for multi-engine Truth Audit (Claude Sonnet).
 * API key sourced from ANTHROPIC_API_KEY env var.
 */
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Google Generative AI provider — used for multi-engine Truth Audit (Gemini).
 * API key sourced from GOOGLE_GENERATIVE_AI_API_KEY env var.
 */
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
```

### 3c — Add model registry entries

Add new entries to the `MODELS` object. Place them after the existing `'sov-query-openai'` entry:

```typescript
/** Truth Audit — Anthropic engine (multi-engine comparison) */
'truth-audit-anthropic': anthropic('claude-sonnet-4-20250514'),

/** Truth Audit — Google engine (multi-engine comparison) */
'truth-audit-gemini': google('gemini-2.0-flash'),

/** Truth Audit — OpenAI engine (multi-engine comparison) */
'truth-audit-openai': openai('gpt-4o-mini'),

/** Truth Audit — Perplexity engine (multi-engine comparison, live web) */
'truth-audit-perplexity': perplexity('sonar'),
```

### 3d — Expand `hasApiKey()` function

Update the `hasApiKey` function signature and body to support the two new providers:

```typescript
export function hasApiKey(provider: 'openai' | 'perplexity' | 'anthropic' | 'google'): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'perplexity') return !!process.env.PERPLEXITY_API_KEY;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  if (provider === 'google') return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  return false;
}
```

### 3e — Update the file header comment

In the top-of-file comment block, the `Usage:` example references `import { openai, perplexity, getModel }`. Update it to:

```typescript
//   import { openai, perplexity, anthropic, google, getModel } from '@/lib/ai/providers';
```

## Step 4 — Verify the edit

After editing `lib/ai/providers.ts`, run:

```bash
npm run build
npm run test
```

All existing tests MUST still pass. The `hasApiKey` type change is backward-compatible — existing callers pass `'openai'` or `'perplexity'`, which are still valid members of the expanded union type.

## Step 5 — Create a unit test for the new providers

Create `src/__tests__/unit/ai-providers.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Unit test: AI providers — verify all provider instances and model registry
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

describe('lib/ai/providers', () => {
  it('exports all provider instances', async () => {
    const providers = await import('@/lib/ai/providers');
    expect(providers.openai).toBeDefined();
    expect(providers.perplexity).toBeDefined();
    expect(providers.anthropic).toBeDefined();
    expect(providers.google).toBeDefined();
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
    expect(() => getModel('truth-audit-anthropic')).not.toThrow();
    expect(() => getModel('truth-audit-gemini')).not.toThrow();
    expect(() => getModel('truth-audit-openai')).not.toThrow();
    expect(() => getModel('truth-audit-perplexity')).not.toThrow();
  });

  it('getModel throws for unknown keys', async () => {
    const { getModel } = await import('@/lib/ai/providers');
    // @ts-expect-error — intentionally testing invalid key
    expect(() => getModel('nonexistent-model')).toThrow('[ai/providers] Unknown model key');
  });

  it('hasApiKey returns boolean for all supported providers', async () => {
    const { hasApiKey } = await import('@/lib/ai/providers');
    // Without env vars set, all should return false
    expect(typeof hasApiKey('openai')).toBe('boolean');
    expect(typeof hasApiKey('perplexity')).toBe('boolean');
    expect(typeof hasApiKey('anthropic')).toBe('boolean');
    expect(typeof hasApiKey('google')).toBe('boolean');
  });
});
```

## Step 6 — Final verification

```bash
npm run build
npm run test
```

All tests must pass, including the new `ai-providers.test.ts`.

## Step 7 — Commit

```
feat: add @ai-sdk/anthropic and @ai-sdk/google providers

Multi-engine support for Feature #2 (AI Truth Audit):
- @ai-sdk/anthropic: Claude Sonnet for Anthropic engine queries
- @ai-sdk/google: Gemini 2.0 Flash for Google engine queries
- New model registry keys: truth-audit-anthropic, truth-audit-gemini,
  truth-audit-openai, truth-audit-perplexity
- Expanded hasApiKey() to support all 4 providers
- Unit tests for provider exports and model registry

Only lib/ai/providers.ts modified. No changes to existing services.
```

## Rules

- The ONLY existing file you may modify is `lib/ai/providers.ts`
- Do NOT modify `lib/ai/actions.ts`
- Do NOT modify any service file in `lib/services/`
- Do NOT modify `app/actions/marketing.ts`
- Do NOT modify any test file in `src/__tests__/` (only create the new one)
- Do NOT create `.env` or `.env.local` files
- Do NOT add env vars to any Vercel config
- If `npm run build` or `npm run test` fails after editing `providers.ts`, STOP and report the error
- Existing tests that mock `hasApiKey` pass `'openai'` or `'perplexity'` — these remain valid after the type expansion and must not break
