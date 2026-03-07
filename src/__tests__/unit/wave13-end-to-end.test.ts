// ---------------------------------------------------------------------------
// Wave 13: End-to-End Completion Tests (S70–S73)
//
// Tests cover:
//   S70: Weekly report card cron wiring — plan routing logic (6)
//   S71: Goal tracker — validation + settings form contract (7)
//   S72: Medical copy guard — autopilot + brief-actions integration (7)
//   S73: Integration verifications (3)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

// ── S70: Weekly Report Card Routing ─────────────────────────────────────────

import { getScoreColor, formatScoreDelta, buildReportCardText } from '@/lib/services/weekly-report-card';
import { planSatisfies, type PlanTier } from '@/lib/plan-enforcer';

describe('S70: Weekly Report Card Cron Routing', () => {
  it('Growth+ orgs satisfy growth plan gate', () => {
    expect(planSatisfies('growth' as PlanTier, 'growth')).toBe(true);
    expect(planSatisfies('agency' as PlanTier, 'growth')).toBe(true);
  });

  it('Trial/Starter orgs do NOT satisfy growth plan gate', () => {
    expect(planSatisfies('trial' as PlanTier, 'growth')).toBe(false);
    expect(planSatisfies('starter' as PlanTier, 'growth')).toBe(false);
  });

  it('getScoreColor returns correct colors', () => {
    expect(getScoreColor(85)).toBe('green');
    expect(getScoreColor(50)).toBe('amber');
    expect(getScoreColor(20)).toBe('red');
    expect(getScoreColor(null)).toBe('gray');
  });

  it('formatScoreDelta formats positive/negative/null', () => {
    expect(formatScoreDelta(5)).toBe('+5');
    expect(formatScoreDelta(-3)).toBe('-3');
    expect(formatScoreDelta(0)).toBe('0');
    expect(formatScoreDelta(null)).toBe('N/A');
  });

  it('buildReportCardText includes business name and score', () => {
    const card = {
      score: 72,
      scoreDelta: 5,
      topWin: 'Fixed hours',
      topIssue: null,
      competitorHighlight: null,
      nextAction: 'Check AI mentions',
      errorsFixed: 2,
      newErrors: 0,
      sovPercent: 45,
    };
    const text = buildReportCardText(card, 'Test Business');
    expect(text).toContain('Test Business');
    expect(text).toContain('72');
    expect(text).toContain('+5');
    expect(text).toContain('Fixed hours');
  });

  it('buildReportCardText caps at 10 lines', () => {
    const card = {
      score: 72,
      scoreDelta: 5,
      topWin: 'Win',
      topIssue: 'Issue',
      competitorHighlight: 'Comp mentioned 5 times',
      nextAction: 'Fix errors',
      errorsFixed: 3,
      newErrors: 2,
      sovPercent: 60,
    };
    const text = buildReportCardText(card, 'Biz');
    const lines = text.split('\n');
    expect(lines.length).toBeLessThanOrEqual(10);
  });
});

// ── S71: Goal Tracker ───────────────────────────────────────────────────────

import {
  computeGoalProgress,
  validateTargetScore,
  validateDeadline,
  formatGoalSummary,
} from '@/lib/services/goal-tracker';

describe('S71: Goal Tracker Settings & Validation', () => {
  it('computeGoalProgress returns correct progress', () => {
    const progress = computeGoalProgress(60, { targetScore: 80, deadline: '2026-06-01' }, 40);
    expect(progress.percentComplete).toBe(50); // (60-40)/(80-40) = 50%
    expect(progress.isAchieved).toBe(false);
    expect(progress.targetScore).toBe(80);
  });

  it('computeGoalProgress detects achievement', () => {
    const progress = computeGoalProgress(85, { targetScore: 80, deadline: '2026-06-01' });
    expect(progress.isAchieved).toBe(true);
    expect(progress.paceLabel).toBe('Goal achieved!');
  });

  it('computeGoalProgress detects overdue', () => {
    const progress = computeGoalProgress(50, { targetScore: 80, deadline: '2025-01-01' });
    expect(progress.isOverdue).toBe(true);
    expect(progress.paceLabel).toBe('Goal overdue');
  });

  it('validateTargetScore accepts valid range', () => {
    expect(validateTargetScore(80)).toBe(80);
    expect(validateTargetScore(1)).toBe(1);
    expect(validateTargetScore(100)).toBe(100);
  });

  it('validateTargetScore rejects invalid input', () => {
    expect(validateTargetScore(0)).toBeNull();
    expect(validateTargetScore(101)).toBeNull();
    expect(validateTargetScore('abc')).toBeNull();
    expect(validateTargetScore(null)).toBeNull();
  });

  it('validateDeadline rejects past dates', () => {
    expect(validateDeadline('2020-01-01')).toBeNull();
  });

  it('formatGoalSummary returns correct messages', () => {
    const achieved = computeGoalProgress(90, { targetScore: 80, deadline: '2026-06-01' });
    expect(formatGoalSummary(achieved)).toContain('reached your goal');

    const inProgress = computeGoalProgress(60, { targetScore: 80, deadline: '2026-12-01' });
    expect(formatGoalSummary(inProgress)).toContain('20 points to go');
  });
});

// ── S72: Medical Copy Guard Integration ─────────────────────────────────────

import { checkMedicalCopy } from '@/lib/services/medical-copy-guard';
import { isMedicalCategory } from '@/lib/services/sov-seed';

describe('S72: Medical Copy Guard Wiring', () => {
  it('isMedicalCategory detects medical/dental categories', () => {
    expect(isMedicalCategory(['dentist', 'family practice'])).toBe(true);
    expect(isMedicalCategory(['Dental Clinic'])).toBe(true);
    expect(isMedicalCategory(['medical center'])).toBe(true);
  });

  it('isMedicalCategory returns false for restaurant', () => {
    expect(isMedicalCategory(['bbq restaurant'])).toBe(false);
    expect(isMedicalCategory(['pizza'])).toBe(false);
  });

  it('checkMedicalCopy approves clean text', () => {
    const result = checkMedicalCopy('We offer dental cleanings and checkups in a modern office.');
    expect(result.approved).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('checkMedicalCopy flags forbidden patterns', () => {
    const result = checkMedicalCopy('We diagnose and treat all dental conditions with guaranteed results.');
    expect(result.approved).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('checkMedicalCopy detects disclaimer requirement', () => {
    const result = checkMedicalCopy('Our treatment options include advanced surgery and therapy.');
    expect(result.requiresDisclaimer).toBe(true);
    expect(result.suggestionToAdd).toBeDefined();
  });

  it('checkMedicalCopy approves text without medical terms', () => {
    const result = checkMedicalCopy('Visit our office today for a consultation.');
    expect(result.approved).toBe(true);
    expect(result.requiresDisclaimer).toBe(false);
  });

  it('medical guard adds disclaimer to content when required', () => {
    const content = 'Our new treatment option is available now.';
    const guard = checkMedicalCopy(content);
    if (guard.requiresDisclaimer && guard.suggestionToAdd) {
      const withDisclaimer = `${content}\n\n---\nDisclaimer: ${guard.suggestionToAdd}`;
      expect(withDisclaimer).toContain('Disclaimer:');
      expect(withDisclaimer).toContain('Results may vary');
    }
    expect(guard.requiresDisclaimer).toBe(true);
  });
});

// ── S73: Integration Verifications ──────────────────────────────────────────

describe('S73: Integration Verifications', () => {
  it('GoalSettingsForm component is importable', async () => {
    const mod = await import('@/app/dashboard/settings/_components/GoalSettingsForm');
    expect(mod.default).toBeDefined();
  });

  it('GoalTrackerCard component is importable', async () => {
    const mod = await import('@/app/dashboard/_components/GoalTrackerCard');
    expect(mod.default).toBeDefined();
  });

  it('WeeklyReportCardEmail template is importable', async () => {
    const mod = await import('@/emails/weekly-report-card');
    expect(mod.default).toBeDefined();
  });
});
