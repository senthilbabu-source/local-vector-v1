// ---------------------------------------------------------------------------
// sov-grok-youcom.test.ts — Unit tests for Grok (xAI) + You.com SOV Engines
//
// Sprint 2: Validates model config, plan gating, and API key checks for
// the two new SOV engines added in Sprint 2.
//
// Run:
//   npx vitest run src/__tests__/unit/sov-grok-youcom.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn(),
  jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })),
}));

// ── Mock the providers (but import real config) ──────────────────────────
vi.mock('@/lib/ai/providers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/providers')>('@/lib/ai/providers');
  return {
    ...actual,
    // Keep real hasApiKey — we test it with env manipulation
  };
});

// ── Imports ──────────────────────────────────────────────────────────────

import { getEnabledModels, SOV_MODEL_CONFIGS } from '@/lib/config/sov-models';
import { hasApiKey, MODELS } from '@/lib/ai/providers';

// ── Setup ────────────────────────────────────────────────────────────────

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

// ── Plan gating tests ────────────────────────────────────────────────────

describe('Grok + You.com plan gating', () => {
  it('agency plan includes grok_xai', () => {
    expect(getEnabledModels('agency')).toContain('grok_xai');
  });

  it('agency plan includes youcom_search', () => {
    expect(getEnabledModels('agency')).toContain('youcom_search');
  });

  it('growth plan does NOT include grok_xai', () => {
    expect(getEnabledModels('growth')).not.toContain('grok_xai');
  });

  it('growth plan does NOT include youcom_search', () => {
    expect(getEnabledModels('growth')).not.toContain('youcom_search');
  });

  it('starter plan does NOT include grok_xai', () => {
    expect(getEnabledModels('starter')).not.toContain('grok_xai');
  });

  it('starter plan does NOT include youcom_search', () => {
    expect(getEnabledModels('starter')).not.toContain('youcom_search');
  });
});

// ── Model config shape tests ─────────────────────────────────────────────

describe('SOV_MODEL_CONFIGS — Grok + You.com', () => {
  it('grok_xai is_proxy is false', () => {
    expect(SOV_MODEL_CONFIGS['grok_xai'].is_proxy).toBe(false);
  });

  it('youcom_search is_proxy is false', () => {
    expect(SOV_MODEL_CONFIGS['youcom_search'].is_proxy).toBe(false);
  });

  it('grok_xai api_key_provider is xai', () => {
    expect(SOV_MODEL_CONFIGS['grok_xai'].api_key_provider).toBe('xai');
  });

  it('youcom_search api_key_provider is youcom', () => {
    expect(SOV_MODEL_CONFIGS['youcom_search'].api_key_provider).toBe('youcom');
  });
});

// ── API key availability tests ───────────────────────────────────────────

describe('hasApiKey — xai + youcom', () => {
  it('hasApiKey("xai") returns false when XAI_API_KEY is not set', () => {
    delete process.env.XAI_API_KEY;
    expect(hasApiKey('xai')).toBe(false);
  });

  it('hasApiKey("youcom") returns false when YOUCOM_API_KEY is not set', () => {
    delete process.env.YOUCOM_API_KEY;
    expect(hasApiKey('youcom')).toBe(false);
  });
});

// ── MODELS registry tests ────────────────────────────────────────────────

describe('MODELS registry — Grok + You.com', () => {
  it('sov-query-grok is defined', () => {
    expect(MODELS['sov-query-grok']).toBeDefined();
  });

  it('sov-query-youcom is defined', () => {
    expect(MODELS['sov-query-youcom']).toBeDefined();
  });
});
