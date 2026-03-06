// ---------------------------------------------------------------------------
// score-milestone.test.ts — S20 (AI_RULES §220)
//
// Unit tests for detectScoreMilestone() and formatMilestoneMessage().
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  detectScoreMilestone,
  formatMilestoneMessage,
} from '@/lib/services/score-milestone.service';

describe('detectScoreMilestone', () => {
  it('49→51 crosses milestone 50', () => {
    const m = detectScoreMilestone(51, 49);
    expect(m).not.toBeNull();
    expect(m!.threshold).toBe(50);
  });

  it('59→61 crosses milestone 60', () => {
    const m = detectScoreMilestone(61, 59);
    expect(m!.threshold).toBe(60);
  });

  it('79→80 crosses milestone 80', () => {
    const m = detectScoreMilestone(80, 79);
    expect(m!.threshold).toBe(80);
  });

  it('89→90 crosses milestone 90', () => {
    const m = detectScoreMilestone(90, 89);
    expect(m!.threshold).toBe(90);
  });

  it('80→82 (already past milestone) returns null', () => {
    expect(detectScoreMilestone(82, 80)).toBeNull();
  });

  it('48→49 (approaching but not crossing) returns null', () => {
    expect(detectScoreMilestone(49, 48)).toBeNull();
  });

  it('returns null when score went down', () => {
    expect(detectScoreMilestone(70, 85)).toBeNull();
  });

  it('returns null when current is null', () => {
    expect(detectScoreMilestone(null, 45)).toBeNull();
  });

  it('returns null when previous is null', () => {
    expect(detectScoreMilestone(75, null)).toBeNull();
  });

  it('45→82 returns milestone 80 (highest crossed)', () => {
    const m = detectScoreMilestone(82, 45);
    // Milestones checked in order: 90, 80, 70, 60, 50. First match = highest crossed.
    // 82 >= 80 && 45 < 80 → yes, returns 80
    expect(m!.threshold).toBe(80);
  });

  it('45→95 returns milestone 90 (highest crossed)', () => {
    const m = detectScoreMilestone(95, 45);
    expect(m!.threshold).toBe(90);
  });

  it('equal scores returns null', () => {
    expect(detectScoreMilestone(75, 75)).toBeNull();
  });
});

describe('formatMilestoneMessage', () => {
  it('returns non-empty string', () => {
    const msg = formatMilestoneMessage({ threshold: 80, label: '80' });
    expect(msg.length).toBeGreaterThan(0);
  });

  it('includes milestone threshold in message', () => {
    const msg = formatMilestoneMessage({ threshold: 80, label: '80' });
    expect(msg).toContain('80');
  });

  it('includes city when provided', () => {
    const msg = formatMilestoneMessage({ threshold: 80, label: '80' }, 'Alpharetta');
    expect(msg).toContain('Alpharetta');
  });

  it('omits city part when city is null', () => {
    const msg = formatMilestoneMessage({ threshold: 80, label: '80' }, null);
    expect(msg).not.toContain('top quarter');
  });
});
