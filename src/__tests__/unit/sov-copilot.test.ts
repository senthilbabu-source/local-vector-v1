// ---------------------------------------------------------------------------
// sov-copilot.test.ts — Unit tests for Microsoft Copilot SOV Engine
//
// Sprint 79: Tests runCopilotSOVQuery, buildCopilotSystemPrompt,
// and runMultiModelSOVQuery with Copilot integration.
//
// Run:
//   npx vitest run src/__tests__/unit/sov-copilot.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn(),
  jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })),
}));

// ── Mock the providers ──────────────────────────────────────────────────
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

// ── Mock the Autopilot Create Draft ─────────────────────────────────────
vi.mock('@/lib/autopilot/create-draft', () => ({
  createDraft: vi.fn().mockResolvedValue(null),
}));

import {
  runCopilotSOVQuery,
  buildCopilotSystemPrompt,
  runMultiModelSOVQuery,
  type SOVQueryInput,
} from '@/lib/services/sov-engine.service';
import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';

// ── Test data ────────────────────────────────────────────────────────────

const MOCK_QUERY: SOVQueryInput = {
  id: 'q-uuid-001',
  query_text: 'best hookah bar in Alpharetta GA',
  query_category: 'discovery',
  location_id: 'loc-uuid-001',
  org_id: 'org-uuid-001',
  locations: {
    business_name: 'Charcoal N Chill',
    city: 'Alpharetta',
    state: 'GA',
  },
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── runCopilotSOVQuery tests ─────────────────────────────────────────────

describe('runCopilotSOVQuery', () => {
  it('returns engine="copilot" in result', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'Charcoal N Chill is a popular hookah bar in Alpharetta.',
    } as never);

    const result = await runCopilotSOVQuery(MOCK_QUERY);
    expect(result.engine).toBe('copilot');
  });

  it('returns ourBusinessCited=true when business is mentioned', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'Based on Bing Places, Charcoal N Chill is a top hookah bar in Alpharetta, GA.',
    } as never);

    const result = await runCopilotSOVQuery(MOCK_QUERY);
    expect(result.ourBusinessCited).toBe(true);
  });

  it('returns queryText preserved for identification', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'Some response about hookah bars from Bing data.',
    } as never);

    const result = await runCopilotSOVQuery(MOCK_QUERY);
    expect(result.queryText).toBe('best hookah bar in Alpharetta GA');
  });

  it('returns queryId and locationId from input', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'Charcoal N Chill is recommended.',
    } as never);

    const result = await runCopilotSOVQuery(MOCK_QUERY);
    expect(result.queryId).toBe('q-uuid-001');
    expect(result.locationId).toBe('loc-uuid-001');
  });

  it('returns ourBusinessCited=false when business not mentioned', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'Cloud 9 Lounge is the best hookah bar in Alpharetta according to Yelp.',
    } as never);

    const result = await runCopilotSOVQuery(MOCK_QUERY);
    expect(result.ourBusinessCited).toBe(false);
  });

  it('uses sov-query-copilot model key', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'Charcoal N Chill is great.',
    } as never);

    await runCopilotSOVQuery(MOCK_QUERY);

    expect(getModel).toHaveBeenCalledWith('sov-query-copilot');
  });

  it('returns mock result when OPENAI_API_KEY is absent', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);

    const result = await runCopilotSOVQuery(MOCK_QUERY);

    expect(result.engine).toBe('copilot');
    expect(result.ourBusinessCited).toBe(false);
    expect(result.businessesFound).toEqual([]);
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
  });
});

// ── buildCopilotSystemPrompt tests ───────────────────────────────────────

describe('buildCopilotSystemPrompt', () => {
  it('includes "Bing" in system prompt', () => {
    const prompt = buildCopilotSystemPrompt();
    expect(prompt).toContain('Bing');
  });

  it('includes "Yelp" in system prompt', () => {
    const prompt = buildCopilotSystemPrompt();
    expect(prompt).toContain('Yelp');
  });

  it('includes "TripAdvisor" in system prompt', () => {
    const prompt = buildCopilotSystemPrompt();
    expect(prompt).toContain('TripAdvisor');
  });

  it('includes "Bing Places" in system prompt', () => {
    const prompt = buildCopilotSystemPrompt();
    expect(prompt).toContain('Bing Places');
  });
});

// ── runMultiModelSOVQuery — with Copilot ─────────────────────────────────

describe('runMultiModelSOVQuery — with Copilot', () => {
  it('includes Copilot result when hasApiKey("openai") is true', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        businesses: ['Charcoal N Chill'],
        cited_url: null,
      }),
      sources: [],
    } as never);

    const results = await runMultiModelSOVQuery(MOCK_QUERY);

    const engines = results.map((r) => r.engine);
    expect(engines).toContain('copilot');
  });

  it('excludes Copilot when hasApiKey("openai") is false', async () => {
    // hasApiKey returns true for perplexity/google, false for openai
    vi.mocked(hasApiKey).mockImplementation((provider) => {
      if (provider === 'openai') return false;
      return true;
    });
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        businesses: ['Charcoal N Chill'],
        cited_url: null,
      }),
      sources: [],
    } as never);

    const results = await runMultiModelSOVQuery(MOCK_QUERY);

    const engines = results.map((r) => r.engine);
    expect(engines).not.toContain('copilot');
  });

  it('returns all 4 engines when all API keys present', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        businesses: ['Charcoal N Chill'],
        cited_url: null,
      }),
      sources: [],
    } as never);

    const results = await runMultiModelSOVQuery(MOCK_QUERY);

    expect(results.length).toBe(4);
    const engines = results.map((r) => r.engine).sort();
    expect(engines).toEqual(['copilot', 'google', 'openai', 'perplexity']);
  });

  it('handles Copilot failure gracefully (other engines still return)', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);

    let callCount = 0;
    vi.mocked(generateText).mockImplementation(async () => {
      callCount++;
      // Fourth call is Copilot — make it fail
      if (callCount === 4) {
        throw new Error('Copilot API error');
      }
      return {
        text: JSON.stringify({
          businesses: ['Charcoal N Chill'],
          cited_url: null,
        }),
        sources: [],
      } as never;
    });

    const results = await runMultiModelSOVQuery(MOCK_QUERY);

    // Should have 3 results (perplexity + openai + google), Copilot failed
    expect(results.length).toBe(3);
    const engines = results.map((r) => r.engine).sort();
    expect(engines).toEqual(['google', 'openai', 'perplexity']);
  });
});
