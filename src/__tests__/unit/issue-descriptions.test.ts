// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  describeAlert,
  getModelName,
  mapSeverity,
  describeTechnicalFinding,
  type TechnicalFindingInput,
} from '@/lib/issue-descriptions';
import type { HallucinationRow } from '@/lib/data/dashboard';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<HallucinationRow> = {}): HallucinationRow {
  return {
    id: 'test-id',
    severity: 'critical',
    category: null,
    model_provider: 'openai-gpt4o',
    claim_text: 'Test claim',
    expected_truth: 'Test truth',
    correction_status: 'open',
    first_detected_at: '2026-02-20T00:00:00Z',
    last_seen_at: '2026-02-25T00:00:00Z',
    occurrence_count: 1,
    follow_up_result: null,
    ...overrides,
  };
}

// ─── describeAlert — Wrong hours ────────────────────────────────────────────

describe('describeAlert()', () => {
  describe('category: hours', () => {
    it('returns severity=critical for a critical hours alert', () => {
      const result = describeAlert(makeAlert({ category: 'hours', severity: 'critical' }));
      expect(result.severity).toBe('critical');
      expect(result.fixLabel).toBe('Fix with AI');
    });

    it('includes model name and claim_text when both present', () => {
      const result = describeAlert(
        makeAlert({
          category: 'hours',
          model_provider: 'perplexity-sonar',
          claim_text: 'Closes at 10pm',
          expected_truth: 'Open until 2am',
        }),
      );
      expect(result.headline).toContain('Perplexity');
      expect(result.headline).toContain('Closes at 10pm');
      expect(result.headline).toContain('Open until 2am');
    });

    it('falls back gracefully when claim_text is empty', () => {
      const result = describeAlert(
        makeAlert({ category: 'hours', claim_text: '', expected_truth: null }),
      );
      expect(result.headline).toContain('incorrect business hours');
    });

    it('costsCredit is true for hours alerts', () => {
      const result = describeAlert(makeAlert({ category: 'hours' }));
      expect(result.costsCredit).toBe(true);
    });
  });

  // ── Wrong location ──────────────────────────────────────────────────────

  describe('category: address', () => {
    it('returns severity=critical for a critical address alert', () => {
      const result = describeAlert(makeAlert({ category: 'address', severity: 'critical' }));
      expect(result.severity).toBe('critical');
    });

    it('includes claim_text when present', () => {
      const result = describeAlert(
        makeAlert({ category: 'address', claim_text: '123 Wrong St' }),
      );
      expect(result.headline).toContain('123 Wrong St');
    });

    it('includes subtext about directions', () => {
      const result = describeAlert(makeAlert({ category: 'address' }));
      expect(result.subtext).toContain('Customers');
    });
  });

  // ── Wrong phone ─────────────────────────────────────────────────────────

  describe('category: phone', () => {
    it('returns severity=critical for a critical phone alert', () => {
      const result = describeAlert(makeAlert({ category: 'phone', severity: 'critical' }));
      expect(result.severity).toBe('critical');
    });

    it('includes the wrong phone number', () => {
      const result = describeAlert(
        makeAlert({ category: 'phone', claim_text: '555-0199' }),
      );
      expect(result.headline).toContain('555-0199');
    });
  });

  // ── Wrong menu ──────────────────────────────────────────────────────────

  describe('category: menu', () => {
    it('returns fixLabel=Fix with AI', () => {
      const result = describeAlert(makeAlert({ category: 'menu', severity: 'medium' }));
      expect(result.fixLabel).toBe('Fix with AI');
    });

    it('maps medium severity to warning', () => {
      const result = describeAlert(makeAlert({ category: 'menu', severity: 'medium' }));
      expect(result.severity).toBe('warning');
    });
  });

  // ── Business status ─────────────────────────────────────────────────────

  describe('category: status', () => {
    it('includes claim_text in headline', () => {
      const result = describeAlert(
        makeAlert({
          category: 'status',
          claim_text: 'Permanently closed',
          expected_truth: 'Open for business',
        }),
      );
      expect(result.headline).toContain('Permanently closed');
    });

    it('includes subtext about customers going elsewhere', () => {
      const result = describeAlert(makeAlert({ category: 'status' }));
      expect(result.subtext).toContain('somewhere else');
    });
  });

  // ── Amenity ─────────────────────────────────────────────────────────────

  describe('category: amenity', () => {
    it('returns costsCredit=true', () => {
      const result = describeAlert(makeAlert({ category: 'amenity' }));
      expect(result.costsCredit).toBe(true);
    });
  });

  // ── Fallback ────────────────────────────────────────────────────────────

  describe('fallback (unknown category)', () => {
    it('uses claim_text as headline for unknown category', () => {
      const result = describeAlert(
        makeAlert({ category: 'unknown_type', claim_text: 'Something wrong' }),
      );
      expect(result.headline).toContain('Something wrong');
    });

    it('returns severity=info for low severity fallback', () => {
      const result = describeAlert(
        makeAlert({ category: 'unknown_type', severity: 'low' }),
      );
      expect(result.severity).toBe('info');
    });

    it('fixLabel is View details for fallback', () => {
      const result = describeAlert(makeAlert({ category: 'unknown_type' }));
      expect(result.fixLabel).toBe('View details →');
    });

    it('costsCredit is false for fallback', () => {
      const result = describeAlert(makeAlert({ category: 'unknown_type' }));
      expect(result.costsCredit).toBe(false);
    });
  });

  // ── fixHref ─────────────────────────────────────────────────────────────

  it('all known categories link to /dashboard/hallucinations', () => {
    for (const cat of ['hours', 'address', 'phone', 'menu', 'status', 'amenity']) {
      const result = describeAlert(makeAlert({ category: cat }));
      expect(result.fixHref).toBe('/dashboard/hallucinations');
    }
  });
});

// ─── getModelName ───────────────────────────────────────────────────────────

describe('getModelName()', () => {
  it('maps openai-gpt4o to ChatGPT', () => {
    expect(getModelName('openai-gpt4o')).toBe('ChatGPT');
  });

  it('maps perplexity-sonar to Perplexity', () => {
    expect(getModelName('perplexity-sonar')).toBe('Perplexity');
  });

  it('maps google-gemini to Gemini', () => {
    expect(getModelName('google-gemini')).toBe('Gemini');
  });

  it('maps anthropic-claude to Claude', () => {
    expect(getModelName('anthropic-claude')).toBe('Claude');
  });

  it('maps microsoft-copilot to Microsoft Copilot', () => {
    expect(getModelName('microsoft-copilot')).toBe('Microsoft Copilot');
  });

  it('returns "An AI model" for null', () => {
    expect(getModelName(null)).toBe('An AI model');
  });

  it('returns "An AI model" for undefined', () => {
    expect(getModelName(undefined)).toBe('An AI model');
  });

  it('returns the string as-is for unknown provider', () => {
    expect(getModelName('some-new-model')).toBe('some-new-model');
  });
});

// ─── mapSeverity ────────────────────────────────────────────────────────────

describe('mapSeverity()', () => {
  it('maps critical to critical', () => {
    expect(mapSeverity('critical')).toBe('critical');
  });

  it('maps high to critical', () => {
    expect(mapSeverity('high')).toBe('critical');
  });

  it('maps medium to warning', () => {
    expect(mapSeverity('medium')).toBe('warning');
  });

  it('maps low to info', () => {
    expect(mapSeverity('low')).toBe('info');
  });
});

// ─── describeTechnicalFinding ───────────────────────────────────────────────

describe('describeTechnicalFinding()', () => {
  it('bot_blind_spot returns severity=warning', () => {
    const result = describeTechnicalFinding({ type: 'bot_blind_spot' });
    expect(result.severity).toBe('warning');
    expect(result.fixHref).toBe('/dashboard/crawler-analytics');
  });

  it('bot_blind_spot includes botName in headline', () => {
    const result = describeTechnicalFinding({ type: 'bot_blind_spot', botName: 'ClaudeBot' });
    expect(result.headline).toContain('ClaudeBot');
  });

  it('bot_blind_spot with affectedCount includes count in subtext', () => {
    const result = describeTechnicalFinding({
      type: 'bot_blind_spot',
      botName: 'GPTBot',
      affectedCount: 1238,
    });
    expect(result.subtext).toContain('1,238');
  });

  it('content_thin returns severity=info', () => {
    const result = describeTechnicalFinding({ type: 'content_thin' });
    expect(result.severity).toBe('info');
    expect(result.category).toBe('Site health');
  });

  it('schema_missing returns fixHref=/dashboard/magic-menus', () => {
    const result = describeTechnicalFinding({ type: 'schema_missing' });
    expect(result.fixHref).toBe('/dashboard/magic-menus');
    expect(result.fixLabel).toBe('How to fix →');
  });
});
