// ---------------------------------------------------------------------------
// vaio-mission-generator.test.ts — Mission generation unit tests
//
// Sprint 2: VAIO Mission Board
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { generateMissions } from '@/lib/vaio/mission-generator';
import type { MissionGeneratorInput, ScoreBreakdown } from '@/lib/vaio/types';
import { VOICE_SCORE_MAX } from '@/lib/vaio/score-card-helpers';

// ── Fixtures ────────────────────────────────────────────────────────────────

const ZERO_BREAKDOWN: ScoreBreakdown = {
  llms_txt: 0,
  crawler_access: 0,
  voice_citation: 0,
  content_quality: 0,
};

const FULL_BREAKDOWN: ScoreBreakdown = {
  llms_txt: 25,
  crawler_access: 25,
  voice_citation: 30,
  content_quality: 20,
};

const SAMPLE_GAP = {
  category: 'discovery',
  queries: ['Best hookah lounge near Alpharetta?', 'Top hookah spots open late?'],
  weeks_at_zero: 3,
  suggested_query_answer: 'We are open until 2 AM every night with private booths.',
};

const SAMPLE_ISSUE = {
  description: 'Content is too long for voice delivery',
  fix: 'Reduce answer length to under 50 words',
};

function makeInput(
  overrides: Partial<MissionGeneratorInput> = {},
): MissionGeneratorInput {
  return {
    breakdown: ZERO_BREAKDOWN,
    llms_txt_status: 'not_generated',
    voice_gaps: [],
    top_content_issues: [],
    ...overrides,
  };
}

// ── generateMissions ────────────────────────────────────────────────────────

describe('generateMissions', () => {
  // ── Output shape ─────────────────────────────────────────────────────────

  it('returns an array', () => {
    const result = generateMissions(makeInput());
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns up to 5 missions', () => {
    const result = generateMissions(makeInput());
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns exactly 4 missions for a zero breakdown', () => {
    const result = generateMissions(makeInput());
    expect(result).toHaveLength(4);
  });

  it('each mission has required fields', () => {
    const result = generateMissions(makeInput());
    for (const mission of result) {
      expect(mission).toHaveProperty('id');
      expect(mission).toHaveProperty('title');
      expect(mission).toHaveProperty('subtitle');
      expect(mission).toHaveProperty('pts_gain');
      expect(mission).toHaveProperty('component');
      expect(mission).toHaveProperty('steps');
      expect(mission).toHaveProperty('status');
    }
  });

  it('steps are non-empty arrays', () => {
    const result = generateMissions(makeInput());
    for (const mission of result) {
      expect(Array.isArray(mission.steps)).toBe(true);
      expect(mission.steps.length).toBeGreaterThan(0);
    }
  });

  it('each step has a label string', () => {
    const result = generateMissions(makeInput());
    for (const mission of result) {
      for (const step of mission.steps) {
        expect(typeof step.label).toBe('string');
        expect(step.label.length).toBeGreaterThan(0);
      }
    }
  });

  // ── Status (open / done) ─────────────────────────────────────────────────

  it('marks all missions as open when breakdown is all zero', () => {
    const result = generateMissions(makeInput({ breakdown: ZERO_BREAKDOWN }));
    expect(result.every((m) => m.status === 'open')).toBe(true);
  });

  it('marks all missions as done when breakdown is perfect', () => {
    const result = generateMissions(makeInput({ breakdown: FULL_BREAKDOWN }));
    expect(result.every((m) => m.status === 'done')).toBe(true);
  });

  it('marks only the completed component as done in a mixed breakdown', () => {
    const result = generateMissions(
      makeInput({
        breakdown: {
          ...ZERO_BREAKDOWN,
          llms_txt: VOICE_SCORE_MAX.llms_txt, // only llms_txt at max
        },
      }),
    );
    const llmsMission = result.find((m) => m.component === 'llms_txt');
    const otherMissions = result.filter((m) => m.component !== 'llms_txt');
    expect(llmsMission?.status).toBe('done');
    expect(otherMissions.every((m) => m.status === 'open')).toBe(true);
  });

  // ── pts_gain ─────────────────────────────────────────────────────────────

  it('pts_gain equals (max - earned) for each component', () => {
    const breakdown: ScoreBreakdown = {
      llms_txt: 10,
      crawler_access: 5,
      voice_citation: 15,
      content_quality: 8,
    };
    const result = generateMissions(makeInput({ breakdown }));
    const byComponent = Object.fromEntries(result.map((m) => [m.component, m]));
    expect(byComponent.llms_txt.pts_gain).toBe(VOICE_SCORE_MAX.llms_txt - 10);
    expect(byComponent.crawler_access.pts_gain).toBe(VOICE_SCORE_MAX.crawler_access - 5);
    expect(byComponent.voice_citation.pts_gain).toBe(VOICE_SCORE_MAX.voice_citation - 15);
    expect(byComponent.content_quality.pts_gain).toBe(VOICE_SCORE_MAX.content_quality - 8);
  });

  it('pts_gain is 0 for a maxed-out component', () => {
    const breakdown: ScoreBreakdown = { ...ZERO_BREAKDOWN, crawler_access: 25 };
    const result = generateMissions(makeInput({ breakdown }));
    const crawler = result.find((m) => m.component === 'crawler_access');
    expect(crawler?.pts_gain).toBe(0);
  });

  // ── Sorting ───────────────────────────────────────────────────────────────

  it('sorts open missions by pts_gain descending', () => {
    const breakdown: ScoreBreakdown = {
      llms_txt: 0,       // pts_gain = 25
      crawler_access: 0, // pts_gain = 25
      voice_citation: 0, // pts_gain = 30 — highest
      content_quality: 0, // pts_gain = 20
    };
    const result = generateMissions(makeInput({ breakdown }));
    const openMissions = result.filter((m) => m.status === 'open');
    for (let i = 1; i < openMissions.length; i++) {
      expect(openMissions[i - 1].pts_gain).toBeGreaterThanOrEqual(openMissions[i].pts_gain);
    }
  });

  it('done missions sort after open missions', () => {
    const breakdown: ScoreBreakdown = {
      ...ZERO_BREAKDOWN,
      content_quality: VOICE_SCORE_MAX.content_quality, // done
    };
    const result = generateMissions(makeInput({ breakdown }));
    const firstDoneIdx = result.findIndex((m) => m.status === 'done');
    const lastOpenIdx = result.findLastIndex((m) => m.status === 'open');
    expect(firstDoneIdx).toBeGreaterThan(lastOpenIdx);
  });

  it('voice_citation has highest pts_gain when all are zero (30 > 25 > 25 > 20)', () => {
    const result = generateMissions(makeInput({ breakdown: ZERO_BREAKDOWN }));
    expect(result[0].component).toBe('voice_citation');
    expect(result[0].pts_gain).toBe(30);
  });

  // ── Component coverage ────────────────────────────────────────────────────

  it('includes all 4 component missions', () => {
    const result = generateMissions(makeInput());
    const components = result.map((m) => m.component);
    expect(components).toContain('crawler_access');
    expect(components).toContain('llms_txt');
    expect(components).toContain('voice_citation');
    expect(components).toContain('content_quality');
  });

  it('each mission has a unique component', () => {
    const result = generateMissions(makeInput());
    const components = result.map((m) => m.component);
    const unique = new Set(components);
    expect(unique.size).toBe(result.length);
  });

  // ── llms_txt mission ──────────────────────────────────────────────────────

  it('llms_txt mission is open when status is not_generated', () => {
    const result = generateMissions(
      makeInput({ llms_txt_status: 'not_generated', breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'llms_txt')!;
    expect(mission.status).toBe('open');
    expect(mission.pts_gain).toBe(25);
  });

  it('llms_txt mission is done when status is generated and pts at max', () => {
    const result = generateMissions(
      makeInput({
        llms_txt_status: 'generated',
        breakdown: { ...ZERO_BREAKDOWN, llms_txt: 25 },
      }),
    );
    const mission = result.find((m) => m.component === 'llms_txt')!;
    expect(mission.status).toBe('done');
  });

  it('stale llms_txt mission step mentions outdated profile', () => {
    const result = generateMissions(
      makeInput({ llms_txt_status: 'stale', breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'llms_txt')!;
    const labels = mission.steps.map((s) => s.label.toLowerCase());
    expect(labels.some((l) => l.includes('outdated'))).toBe(true);
  });

  // ── voice_citation mission with gaps ──────────────────────────────────────

  it('voice_citation step mentions gap count when gaps exist', () => {
    const result = generateMissions(
      makeInput({ voice_gaps: [SAMPLE_GAP], breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'voice_citation')!;
    const firstStep = mission.steps[0];
    expect(firstStep.label.toLowerCase()).toContain('1 content gap');
  });

  it('voice_citation step detail includes gap query and weeks when gap present', () => {
    const result = generateMissions(
      makeInput({ voice_gaps: [SAMPLE_GAP], breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'voice_citation')!;
    const detail = mission.steps[0].detail ?? '';
    expect(detail).toContain('3'); // weeks_at_zero
  });

  it('voice_citation step does not error with empty gaps', () => {
    const result = generateMissions(
      makeInput({ voice_gaps: [], breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'voice_citation')!;
    expect(mission.steps.length).toBeGreaterThan(0);
  });

  // ── content_quality mission with issues ───────────────────────────────────

  it('content_quality steps include issue descriptions when issues present', () => {
    const result = generateMissions(
      makeInput({ top_content_issues: [SAMPLE_ISSUE], breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'content_quality')!;
    const labels = mission.steps.map((s) => s.label);
    expect(labels).toContain(SAMPLE_ISSUE.description);
  });

  it('content_quality step detail includes fix text', () => {
    const result = generateMissions(
      makeInput({ top_content_issues: [SAMPLE_ISSUE], breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'content_quality')!;
    const issueStep = mission.steps.find((s) => s.label === SAMPLE_ISSUE.description)!;
    expect(issueStep.detail).toBe(SAMPLE_ISSUE.fix);
  });

  it('content_quality uses fallback steps when no issues', () => {
    const result = generateMissions(
      makeInput({ top_content_issues: [], breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'content_quality')!;
    // Fallback steps contain something about words or formatting
    const allText = mission.steps.map((s) => s.label).join(' ').toLowerCase();
    expect(allText).toMatch(/words|sentences|format|voice/);
  });

  it('content_quality caps issue steps at 3 (+ 1 sentence step = 4 max)', () => {
    const manyIssues = [1, 2, 3, 4, 5].map((i) => ({
      description: `Issue ${i}`,
      fix: `Fix ${i}`,
    }));
    const result = generateMissions(
      makeInput({ top_content_issues: manyIssues, breakdown: ZERO_BREAKDOWN }),
    );
    const mission = result.find((m) => m.component === 'content_quality')!;
    expect(mission.steps.length).toBeLessThanOrEqual(4);
  });

  // ── Mission ids ───────────────────────────────────────────────────────────

  it('mission ids are stable and match component names', () => {
    const result = generateMissions(makeInput());
    for (const mission of result) {
      expect(mission.id).toBe(mission.component);
    }
  });
});
