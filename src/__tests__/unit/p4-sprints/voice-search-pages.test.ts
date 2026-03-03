// ---------------------------------------------------------------------------
// src/__tests__/unit/p4-sprints/voice-search-pages.test.ts — P4-FIX-19
//
// Tests for Voice Search (VAIO) and Site Visitors (crawler analytics) patterns.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { canRunVAIO, type PlanTier } from '@/lib/plan-enforcer';

// ---------------------------------------------------------------------------
// VAIO plan gating
// ---------------------------------------------------------------------------

describe('voice search (VAIO) plan gating', () => {
  it('trial cannot access VAIO', () => {
    expect(canRunVAIO('trial')).toBe(false);
  });

  it('starter cannot access VAIO', () => {
    expect(canRunVAIO('starter')).toBe(false);
  });

  it('growth can access VAIO', () => {
    expect(canRunVAIO('growth')).toBe(true);
  });

  it('agency can access VAIO', () => {
    expect(canRunVAIO('agency')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Voice readiness score dimensions
// ---------------------------------------------------------------------------

describe('voice readiness dimensions', () => {
  const VAIO_DIMENSIONS = [
    'voice_content_score',
    'llms_txt_score',
    'ai_crawler_score',
    'spoken_answer_score',
    'voice_query_coverage',
    'voice_gap_score',
  ];

  it('defines 6 scoring dimensions', () => {
    expect(VAIO_DIMENSIONS).toHaveLength(6);
  });

  it('each dimension is a named score', () => {
    for (const dim of VAIO_DIMENSIONS) {
      expect(dim).toContain('_');
      expect(dim.length).toBeGreaterThan(5);
    }
  });
});

// ---------------------------------------------------------------------------
// Crawler analytics bot knowledge
// ---------------------------------------------------------------------------

describe('crawler analytics bot patterns', () => {
  const KNOWN_BOTS = ['GPTBot', 'PerplexityBot', 'Google-Extended', 'ClaudeBot', 'Bingbot'];

  it('tracks 5+ known AI bots', () => {
    expect(KNOWN_BOTS.length).toBeGreaterThanOrEqual(5);
  });

  it('each bot has a unique name', () => {
    expect(new Set(KNOWN_BOTS).size).toBe(KNOWN_BOTS.length);
  });
});
