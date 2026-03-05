// ---------------------------------------------------------------------------
// src/__tests__/unit/vaio-score-foundation.test.ts
//
// Sprint §208 — VAIO Score Foundation
// Tests: computeVoiceReadinessScore breakdown, status route derivation logic,
//        coaching message selection, milestone track labels, revenue stakes line.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { computeVoiceReadinessScore } from '@/lib/vaio/vaio-service';
import {
  getMilestoneLabel,
  getCoachingMessage,
  getRevenueStakesLine,
  MONTHLY_QUERY_MULTIPLIER,
} from '@/lib/vaio/score-card-helpers';
import type { ScoreBreakdown } from '@/lib/vaio/types';

// ---------------------------------------------------------------------------
// 1. computeVoiceReadinessScore — returns correct breakdown object
// ---------------------------------------------------------------------------

describe('computeVoiceReadinessScore — breakdown object', () => {
  it('all-zero inputs returns zero breakdown and zero total', () => {
    const result = computeVoiceReadinessScore('not_generated', 'blocked', 0, 0);
    expect(result.total).toBe(0);
    expect(result.llms_txt).toBe(0);
    expect(result.crawler_access).toBe(0);
    expect(result.voice_citation).toBe(0);
    expect(result.content_quality).toBe(0);
  });

  it('all-max inputs returns max breakdown values and total 100', () => {
    const result = computeVoiceReadinessScore('generated', 'healthy', 1, 100);
    expect(result.llms_txt).toBe(25);
    expect(result.crawler_access).toBe(25);
    expect(result.voice_citation).toBe(30);
    expect(result.content_quality).toBe(20);
    expect(result.total).toBe(100);
  });

  it('partial inputs compute correct individual components', () => {
    // generated → llms=25, partial → crawler=round(25*0.48)=12, citation=0.5*30=15, content=0.5/100*20=0
    const result = computeVoiceReadinessScore('generated', 'partial', 0.5, 50);
    expect(result.llms_txt).toBe(25);
    expect(result.crawler_access).toBe(12); // round(25 * 0.48)
    expect(result.voice_citation).toBe(15); // round(0.5 * 30)
    expect(result.content_quality).toBe(10); // round((50/100) * 20)
    expect(result.total).toBe(25 + 12 + 15 + 10);
  });

  it('stale llms.txt and unknown crawler use partial credit', () => {
    // stale → round(25*0.48)=12; unknown → round(25*0.4)=10
    const result = computeVoiceReadinessScore('stale', 'unknown', 0, 0);
    expect(result.llms_txt).toBe(12);     // round(25 * 0.48)
    expect(result.crawler_access).toBe(10); // round(25 * 0.4)
    expect(result.voice_citation).toBe(0);
    expect(result.content_quality).toBe(0);
    expect(result.total).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// 2. ScoreBreakdown derivation in status route logic
//    (uses computeVoiceReadinessScore — same formula the route applies)
// ---------------------------------------------------------------------------

describe('ScoreBreakdown derivation from stored profile fields', () => {
  // Helper mirrors the on-the-fly derivation in the status route
  function deriveBreakdown(
    llms_txt_status: 'generated' | 'stale' | 'not_generated',
    crawler_overall_health: 'healthy' | 'partial' | 'blocked' | 'unknown',
    voice_citation_rate: number,
  ) {
    return computeVoiceReadinessScore(llms_txt_status, crawler_overall_health, voice_citation_rate, 0);
  }

  it('healthy crawler + generated llms.txt + 0 citation → correct per-component values', () => {
    const bd = deriveBreakdown('generated', 'healthy', 0);
    expect(bd.llms_txt).toBe(25);
    expect(bd.crawler_access).toBe(25);
    expect(bd.voice_citation).toBe(0);
    expect(bd.content_quality).toBe(0);
  });

  it('not_generated llms.txt + blocked crawler + high citation rate', () => {
    // llms=0, crawler=0, citation=round(0.8*30)=24
    const bd = deriveBreakdown('not_generated', 'blocked', 0.8);
    expect(bd.llms_txt).toBe(0);
    expect(bd.crawler_access).toBe(0);
    expect(bd.voice_citation).toBe(24);
    expect(bd.content_quality).toBe(0);
    expect(bd.total).toBe(24);
  });

  it('partial crawler + stale llms.txt + partial citation', () => {
    const bd = deriveBreakdown('stale', 'partial', 0.3);
    expect(bd.llms_txt).toBe(12);            // round(25 * 0.48)
    expect(bd.crawler_access).toBe(12);      // round(25 * 0.48)
    expect(bd.voice_citation).toBe(9);       // round(0.3 * 30)
    expect(bd.total).toBe(12 + 12 + 9);
  });
});

// ---------------------------------------------------------------------------
// 3. Coaching message selection — each weakest component + null fallback
// ---------------------------------------------------------------------------

describe('getCoachingMessage — weakest component routing', () => {
  it('crawler_access weakest → robots.txt coaching message', () => {
    const breakdown: ScoreBreakdown = {
      llms_txt:        25,   // 25/25 = 1.0
      crawler_access:  0,    // 0/25  = 0.0 ← weakest
      voice_citation:  20,   // 20/30 = 0.67
      content_quality: 15,   // 15/20 = 0.75
    };
    const msg = getCoachingMessage(breakdown, 60);
    expect(msg).toContain("AI bots can't read it yet");
    expect(msg).toContain('+25 pts'); // max 25 - earned 0 = 25
  });

  it('llms_txt weakest → AI Business Profile coaching message', () => {
    const breakdown: ScoreBreakdown = {
      llms_txt:        0,    // 0/25  = 0.0 ← weakest
      crawler_access:  20,   // 20/25 = 0.8
      voice_citation:  20,   // 20/30 = 0.67
      content_quality: 15,   // 15/20 = 0.75
    };
    const msg = getCoachingMessage(breakdown, 55);
    expect(msg).toContain("don't have a structured profile");
    expect(msg).toContain('+25 pts'); // 25 - 0 = 25
  });

  it('voice_citation weakest → content gaps coaching message', () => {
    const breakdown: ScoreBreakdown = {
      llms_txt:        25,   // 1.0
      crawler_access:  25,   // 1.0
      voice_citation:  0,    // 0/30 = 0.0 ← weakest
      content_quality: 18,   // 0.9
    };
    const msg = getCoachingMessage(breakdown, 68);
    expect(msg).toContain('rarely recommends you for voice queries');
    expect(msg).toContain('+30 pts'); // 30 - 0 = 30
  });

  it('content_quality weakest → spoken answers coaching message', () => {
    const breakdown: ScoreBreakdown = {
      llms_txt:        20,   // 20/25 = 0.8
      crawler_access:  20,   // 20/25 = 0.8
      voice_citation:  21,   // 21/30 = 0.7
      content_quality: 0,    // 0/20  = 0.0 ← weakest
    };
    const msg = getCoachingMessage(breakdown, 61);
    expect(msg).toContain("isn't formatted for spoken answers");
    expect(msg).toContain('+20 pts'); // 20 - 0 = 20
  });

  it('null breakdown falls back to static ternary based on score', () => {
    expect(getCoachingMessage(null, 75)).toContain('well-optimized for voice search');
    expect(getCoachingMessage(null, 50)).toContain('Some improvements needed');
    expect(getCoachingMessage(null, 20)).toContain('needs attention');
  });
});

// ---------------------------------------------------------------------------
// 4. Milestone track label — score → correct label
// ---------------------------------------------------------------------------

describe('getMilestoneLabel', () => {
  it('score 50 → "20 pts to Well-Optimized"', () => {
    expect(getMilestoneLabel(50)).toBe('20 pts to Well-Optimized');
  });

  it('score 75 → "25 pts to Voice Champion"', () => {
    expect(getMilestoneLabel(75)).toBe('25 pts to Voice Champion');
  });

  it('score 100 → "You\'ve reached Voice Champion"', () => {
    expect(getMilestoneLabel(100)).toBe("You've reached Voice Champion");
  });
});

// ---------------------------------------------------------------------------
// 5. Revenue stakes line — citation_rate and query count → correct output
// ---------------------------------------------------------------------------

describe('getRevenueStakesLine', () => {
  it('citation_rate 0.3 × 14 queries → correct monthly visits estimate', () => {
    // N = Math.round(0.3 * 14 * 4.3) = Math.round(18.06) = 18
    const expected = Math.round(0.3 * 14 * MONTHLY_QUERY_MULTIPLIER);
    const line = getRevenueStakesLine(0.3, 14);
    expect(line).toContain(`${expected}`);
    expect(line).toContain('voice-driven visits reach you each month');
    expect(line).toContain('3×');
  });

  it('zero citation_rate → fallback not-recommending string', () => {
    const line = getRevenueStakesLine(0, 20);
    expect(line).toBe('AI assistants are not yet recommending your business for voice queries.');
  });

  it('null citation_rate → fallback not-recommending string', () => {
    const line = getRevenueStakesLine(null, 10);
    expect(line).toBe('AI assistants are not yet recommending your business for voice queries.');
  });
});
