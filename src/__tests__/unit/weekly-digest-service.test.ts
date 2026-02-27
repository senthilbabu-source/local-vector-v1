// ---------------------------------------------------------------------------
// src/__tests__/unit/weekly-digest-service.test.ts
//
// Sprint 78: Tests for the pure payload builder — buildDigestPayload().
// No mocks needed — pure function only.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildDigestPayload,
  truncate,
  formatProvider,
  formatEngine,
  type DigestDataInput,
} from '@/lib/services/weekly-digest.service';
import { MOCK_DIGEST_INPUT } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helper — base input with all nulls/empties for isolated tests
// ---------------------------------------------------------------------------

function emptyInput(): DigestDataInput {
  return {
    org: { id: 'org-1', name: 'Test Org' },
    owner: { email: 'test@example.com', full_name: null },
    location: { business_name: 'Test Biz', city: 'Atlanta', state: 'GA' },
    currentHealthScore: null,
    previousHealthScore: null,
    currentSov: null,
    previousSov: null,
    newHallucinations: [],
    resolvedHallucinations: 0,
    sovWins: [],
    topRecommendation: null,
    botVisitsThisWeek: 0,
    newBlindSpots: 0,
  };
}

// ---------------------------------------------------------------------------
// Subject line
// ---------------------------------------------------------------------------

describe('buildDigestPayload', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.localvector.ai');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Subject line', () => {
    it('includes health score in subject when available', () => {
      const input = { ...emptyInput(), currentHealthScore: 72 };
      const result = buildDigestPayload(input);
      expect(result.subject).toContain('AI Health: 72');
    });

    it('includes delta in subject when both current and previous exist', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 72,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      expect(result.subject).toContain('(+7)');
    });

    it('uses fallback subject when health score is null', () => {
      const input = emptyInput();
      const result = buildDigestPayload(input);
      expect(result.subject).toContain('Your AI Snapshot');
    });

    it('includes business name in subject', () => {
      const input = emptyInput();
      const result = buildDigestPayload(input);
      expect(result.subject).toContain('Test Biz');
      expect(result.subject).toContain('Weekly');
    });
  });

  // ---------------------------------------------------------------------------
  // Health Score section
  // ---------------------------------------------------------------------------

  describe('Health Score section', () => {
    it('calculates positive delta correctly', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 72,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      expect(result.healthScore.delta).toBe(7);
    });

    it('calculates negative delta correctly', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 60,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      expect(result.healthScore.delta).toBe(-5);
    });

    it('sets trend to up for positive delta', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 72,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      expect(result.healthScore.trend).toBe('up');
    });

    it('sets trend to down for negative delta', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 60,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      expect(result.healthScore.trend).toBe('down');
    });

    it('sets trend to flat for zero delta', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 65,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      expect(result.healthScore.trend).toBe('flat');
    });

    it('sets trend to new when previous is null', () => {
      const input = { ...emptyInput(), currentHealthScore: 65 };
      const result = buildDigestPayload(input);
      expect(result.healthScore.trend).toBe('new');
    });
  });

  // ---------------------------------------------------------------------------
  // SOV section
  // ---------------------------------------------------------------------------

  describe('SOV section', () => {
    it('converts SOV from 0-1 to percentage', () => {
      const input = { ...emptyInput(), currentSov: 0.25 };
      const result = buildDigestPayload(input);
      expect(result.sov.currentPercent).toBe(25);
    });

    it('calculates SOV delta in percentage points', () => {
      const input = { ...emptyInput(), currentSov: 0.25, previousSov: 0.20 };
      const result = buildDigestPayload(input);
      expect(result.sov.delta).toBeCloseTo(5.0, 1);
      expect(result.sov.trend).toBe('up');
    });

    it('handles null SOV gracefully', () => {
      const input = emptyInput();
      const result = buildDigestPayload(input);
      expect(result.sov.currentPercent).toBeNull();
      expect(result.sov.delta).toBeNull();
      expect(result.sov.trend).toBe('new');
    });
  });

  // ---------------------------------------------------------------------------
  // Issues
  // ---------------------------------------------------------------------------

  describe('Issues', () => {
    it('maps hallucinations to issues with severity emoji', () => {
      const input = {
        ...emptyInput(),
        newHallucinations: [
          { claim_text: 'Wrong hours', severity: 'high', model_provider: 'openai-gpt4o' },
        ],
      };
      const result = buildDigestPayload(input);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].text).toContain('GPT-4o');
      expect(result.issues[0].cta.label).toBe('Fix This →');
    });

    it('critical severity gets red emoji', () => {
      const input = {
        ...emptyInput(),
        newHallucinations: [
          { claim_text: 'Permanently closed', severity: 'critical', model_provider: 'openai-gpt4o' },
        ],
      };
      const result = buildDigestPayload(input);
      expect(result.issues[0].emoji).toBe('🔴');
    });

    it('high severity gets orange emoji', () => {
      const input = {
        ...emptyInput(),
        newHallucinations: [
          { claim_text: 'Wrong hours', severity: 'high', model_provider: 'openai-gpt4o' },
        ],
      };
      const result = buildDigestPayload(input);
      expect(result.issues[0].emoji).toBe('🟠');
    });

    it('truncates long claim_text', () => {
      const longClaim = 'A'.repeat(100);
      const input = {
        ...emptyInput(),
        newHallucinations: [
          { claim_text: longClaim, severity: 'high', model_provider: 'openai-gpt4o' },
        ],
      };
      const result = buildDigestPayload(input);
      expect(result.issues[0].text.length).toBeLessThan(longClaim.length + 50);
      expect(result.issues[0].text).toContain('…');
    });

    it('formats model_provider to human-readable name', () => {
      const input = {
        ...emptyInput(),
        newHallucinations: [
          { claim_text: 'Wrong hours', severity: 'high', model_provider: 'perplexity-sonar' },
        ],
      };
      const result = buildDigestPayload(input);
      expect(result.issues[0].text).toContain('Perplexity');
    });
  });

  // ---------------------------------------------------------------------------
  // Wins
  // ---------------------------------------------------------------------------

  describe('Wins', () => {
    it('includes resolved hallucinations count', () => {
      const input = { ...emptyInput(), resolvedHallucinations: 3 };
      const result = buildDigestPayload(input);
      expect(result.wins).toHaveLength(1);
      expect(result.wins[0].text).toContain('3 hallucinations resolved');
      expect(result.wins[0].emoji).toBe('✅');
    });

    it('includes SOV wins with engine name', () => {
      const input = {
        ...emptyInput(),
        sovWins: [{ query_text: 'hookah near me', engine: 'perplexity' }],
      };
      const result = buildDigestPayload(input);
      expect(result.wins).toHaveLength(1);
      expect(result.wins[0].text).toContain('Perplexity');
      expect(result.wins[0].text).toContain('first time!');
    });

    it('includes health score improvement as a win', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 72,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      const scoreWin = result.wins.find((w) => w.text.includes('improved'));
      expect(scoreWin).toBeDefined();
      expect(scoreWin!.text).toContain('7 points');
    });

    it('does not include health score as win when delta <= 0', () => {
      const input = {
        ...emptyInput(),
        currentHealthScore: 60,
        previousHealthScore: 65,
      };
      const result = buildDigestPayload(input);
      const scoreWin = result.wins.find((w) => w.text.includes('improved'));
      expect(scoreWin).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Opportunities
  // ---------------------------------------------------------------------------

  describe('Opportunities', () => {
    it('includes top recommendation with CTA', () => {
      const input = {
        ...emptyInput(),
        topRecommendation: {
          title: 'Add FAQ Schema',
          description: 'FAQ schema helps AI.',
          href: '/dashboard/page-audits',
          estimatedImpact: 8,
        },
      };
      const result = buildDigestPayload(input);
      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].text).toContain('Add FAQ Schema');
      expect(result.opportunities[0].text).toContain('+8 pts');
      expect(result.opportunities[0].cta.label).toBe('Take Action →');
    });

    it('includes blind spots when count > 0', () => {
      const input = { ...emptyInput(), newBlindSpots: 4 };
      const result = buildDigestPayload(input);
      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].text).toContain("4 AI engines");
      expect(result.opportunities[0].cta.label).toBe('View Blind Spots →');
    });

    it('empty opportunities when no recommendation and no blind spots', () => {
      const input = emptyInput();
      const result = buildDigestPayload(input);
      expect(result.opportunities).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('Edge cases', () => {
    it('handles completely empty input (no data at all)', () => {
      const input = emptyInput();
      const result = buildDigestPayload(input);
      expect(result.subject).toContain('Your AI Snapshot');
      expect(result.healthScore.current).toBeNull();
      expect(result.sov.currentPercent).toBeNull();
      expect(result.issues).toHaveLength(0);
      expect(result.wins).toHaveLength(0);
      expect(result.opportunities).toHaveLength(0);
      expect(result.botSummary).toBeNull();
    });

    it('uses MOCK_DIGEST_INPUT and produces valid payload', () => {
      const result = buildDigestPayload(MOCK_DIGEST_INPUT);
      expect(result.recipientEmail).toBe('dev@localvector.ai');
      expect(result.recipientName).toBe('Aruna Surendera Babu');
      expect(result.businessName).toBe('Charcoal N Chill');
      expect(result.healthScore.current).toBe(67);
      expect(result.healthScore.delta).toBe(3);
      expect(result.healthScore.trend).toBe('up');
      expect(result.sov.currentPercent).toBe(19);
      expect(result.issues).toHaveLength(1);
      expect(result.wins.length).toBeGreaterThanOrEqual(2);
      expect(result.opportunities.length).toBeGreaterThanOrEqual(1);
      expect(result.botSummary).toContain('12');
    });

    it('sets dashboardUrl from NEXT_PUBLIC_APP_URL', () => {
      const input = emptyInput();
      const result = buildDigestPayload(input);
      expect(result.dashboardUrl).toBe('https://app.localvector.ai/dashboard');
    });

    it('sets unsubscribeUrl to /dashboard/settings', () => {
      const input = emptyInput();
      const result = buildDigestPayload(input);
      expect(result.unsubscribeUrl).toBe(
        'https://app.localvector.ai/dashboard/settings',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('returns text unchanged when shorter than max', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis when text exceeds max', () => {
    expect(truncate('hello world', 6)).toBe('hello…');
  });
});

describe('formatProvider', () => {
  it('maps known providers to human names', () => {
    expect(formatProvider('openai-gpt4o')).toBe('GPT-4o');
    expect(formatProvider('perplexity-sonar')).toBe('Perplexity');
    expect(formatProvider('google-gemini')).toBe('Gemini');
    expect(formatProvider('anthropic-claude')).toBe('Claude');
  });

  it('returns raw provider for unknown providers', () => {
    expect(formatProvider('unknown-model')).toBe('unknown-model');
  });
});

describe('formatEngine', () => {
  it('maps known engines to human names', () => {
    expect(formatEngine('perplexity')).toBe('Perplexity');
    expect(formatEngine('openai')).toBe('ChatGPT');
    expect(formatEngine('google')).toBe('Google AI Overview');
  });

  it('returns raw engine for unknown engines', () => {
    expect(formatEngine('unknown')).toBe('unknown');
  });
});
