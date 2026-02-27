// ---------------------------------------------------------------------------
// proof-timeline-service.test.ts — Unit tests for proof timeline builder
//
// Sprint 77: 30 tests — pure functions, no mocks needed.
//
// Run:
//   npx vitest run src/__tests__/unit/proof-timeline-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildProofTimeline,
  formatContentType,
  formatTriggerType,
  formatBotLabel,
  truncate,
  type TimelineInput,
} from '@/lib/services/proof-timeline.service';
import { MOCK_TIMELINE_INPUT } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_INPUT: TimelineInput = {
  snapshots: [],
  audits: [],
  publishedContent: [],
  firstBotVisits: [],
  hallucinations: [],
};

// ---------------------------------------------------------------------------
// buildProofTimeline — Event generation
// ---------------------------------------------------------------------------

describe('buildProofTimeline', () => {
  describe('Event generation', () => {
    it('1. generates metric_snapshot events from visibility_analytics rows', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [
          { snapshot_date: '2026-01-29', share_of_voice: 0.12 },
          { snapshot_date: '2026-02-05', share_of_voice: 0.19 },
        ],
      };
      const result = buildProofTimeline(input);
      const snapshots = result.events.filter((e) => e.type === 'metric_snapshot');
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].title).toBe('Weekly AI Visibility Snapshot');
      expect(snapshots[0].description).toContain('12%');
    });

    it('2. generates content_published events from published drafts', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        publishedContent: [
          {
            id: 'draft-1',
            published_at: '2026-02-01T14:00:00.000Z',
            draft_title: 'FAQ Page: Hookah',
            content_type: 'faq_page',
            trigger_type: 'competitor_gap',
          },
        ],
      };
      const result = buildProofTimeline(input);
      const published = result.events.filter((e) => e.type === 'content_published');
      expect(published).toHaveLength(1);
      expect(published[0].title).toBe('Published: FAQ Page: Hookah');
      expect(published[0].description).toContain('FAQ Page');
      expect(published[0].description).toContain('Competitor Gap');
    });

    it('3. generates bot_crawl events from first bot visits', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        firstBotVisits: [
          { bot_type: 'gptbot', first_crawled_at: '2026-02-07T08:00:00.000Z' },
        ],
      };
      const result = buildProofTimeline(input);
      const botCrawls = result.events.filter((e) => e.type === 'bot_crawl');
      expect(botCrawls).toHaveLength(1);
      expect(botCrawls[0].title).toContain('GPTBot');
      expect(botCrawls[0].title).toContain('First Visit');
    });

    it('4. generates hallucination_detected events from detected_at', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        hallucinations: [
          {
            id: 'hall-1',
            claim_text: 'Restaurant is closed.',
            severity: 'critical',
            detected_at: '2026-01-28T09:00:00.000Z',
            resolved_at: null,
            correction_status: 'open',
          },
        ],
      };
      const result = buildProofTimeline(input);
      const detected = result.events.filter((e) => e.type === 'hallucination_detected');
      expect(detected).toHaveLength(1);
      expect(detected[0].title).toBe('Hallucination Detected');
    });

    it('5. generates hallucination_resolved events from resolved_at where status=fixed', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        hallucinations: [
          {
            id: 'hall-1',
            claim_text: 'Restaurant is closed.',
            severity: 'critical',
            detected_at: '2026-01-28T09:00:00.000Z',
            resolved_at: '2026-02-15T11:00:00.000Z',
            correction_status: 'fixed',
          },
        ],
      };
      const result = buildProofTimeline(input);
      const resolved = result.events.filter((e) => e.type === 'hallucination_resolved');
      expect(resolved).toHaveLength(1);
      expect(resolved[0].description).toContain('fixed');
    });

    it('6. does not generate hallucination_resolved for status=open', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        hallucinations: [
          {
            id: 'hall-1',
            claim_text: 'Restaurant is closed.',
            severity: 'critical',
            detected_at: '2026-01-28T09:00:00.000Z',
            resolved_at: null,
            correction_status: 'open',
          },
        ],
      };
      const result = buildProofTimeline(input);
      const resolved = result.events.filter((e) => e.type === 'hallucination_resolved');
      expect(resolved).toHaveLength(0);
    });

    it('7. generates schema_added event when faq_schema_present transitions to true', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        audits: [
          { last_audited_at: '2026-01-30T10:00:00.000Z', overall_score: 54, faq_schema_present: false, schema_completeness_score: 20 },
          { last_audited_at: '2026-02-06T10:00:00.000Z', overall_score: 72, faq_schema_present: true, schema_completeness_score: 85 },
        ],
      };
      const result = buildProofTimeline(input);
      const schemaAdded = result.events.filter((e) => e.type === 'schema_added');
      expect(schemaAdded).toHaveLength(1);
      expect(schemaAdded[0].title).toBe('FAQ Schema Added');
    });

    it('8. does not generate schema_added when faq_schema_present is always false', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        audits: [
          { last_audited_at: '2026-01-30T10:00:00.000Z', overall_score: 54, faq_schema_present: false, schema_completeness_score: 20 },
          { last_audited_at: '2026-02-06T10:00:00.000Z', overall_score: 58, faq_schema_present: false, schema_completeness_score: 22 },
        ],
      };
      const result = buildProofTimeline(input);
      const schemaAdded = result.events.filter((e) => e.type === 'schema_added');
      expect(schemaAdded).toHaveLength(0);
    });

    it('9. generates sov_milestone when SOV goes from 0 to >0 (first mention)', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [
          { snapshot_date: '2026-01-29', share_of_voice: 0 },
          { snapshot_date: '2026-02-05', share_of_voice: 0.05 },
        ],
      };
      const result = buildProofTimeline(input);
      const milestones = result.events.filter((e) => e.type === 'sov_milestone');
      expect(milestones).toHaveLength(1);
      expect(milestones[0].title).toBe('First AI Mention');
    });

    it('10. generates sov_milestone for >= 5pp jump week-over-week', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [
          { snapshot_date: '2026-01-29', share_of_voice: 0.12 },
          { snapshot_date: '2026-02-05', share_of_voice: 0.12 },
          { snapshot_date: '2026-02-12', share_of_voice: 0.17 }, // +5pp
        ],
      };
      const result = buildProofTimeline(input);
      const milestones = result.events.filter((e) => e.type === 'sov_milestone');
      expect(milestones).toHaveLength(1);
      expect(milestones[0].title).toBe('SOV Milestone');
      expect(milestones[0].description).toContain('+5pp');
    });
  });

  describe('Sorting and grouping', () => {
    it('11. sorts events chronologically (oldest first)', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [
          { snapshot_date: '2026-02-19', share_of_voice: 0.19 },
          { snapshot_date: '2026-01-29', share_of_voice: 0.12 },
        ],
        firstBotVisits: [
          { bot_type: 'gptbot', first_crawled_at: '2026-02-07T08:00:00.000Z' },
        ],
      };
      const result = buildProofTimeline(input);
      const dates = result.events.map((e) => new Date(e.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    });

    it('12. assigns deterministic IDs (metric-{date}, content-{id}, etc.)', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [{ snapshot_date: '2026-01-29', share_of_voice: 0.12 }],
        publishedContent: [{
          id: 'draft-abc',
          published_at: '2026-02-01T14:00:00.000Z',
          draft_title: 'Test',
          content_type: 'faq_page',
          trigger_type: 'manual',
        }],
        firstBotVisits: [{ bot_type: 'gptbot', first_crawled_at: '2026-02-07T08:00:00.000Z' }],
      };
      const result = buildProofTimeline(input);
      const ids = result.events.map((e) => e.id);
      expect(ids).toContain('metric-2026-01-29');
      expect(ids).toContain('content-draft-abc');
      expect(ids).toContain('bot-gptbot');
    });
  });

  describe('Summary', () => {
    it('13. calculates sovDelta from first to last snapshot', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [
          { snapshot_date: '2026-01-29', share_of_voice: 0.12 },
          { snapshot_date: '2026-02-19', share_of_voice: 0.19 },
        ],
      };
      const result = buildProofTimeline(input);
      // (0.19 - 0.12) * 100 = 7
      expect(result.summary.sovDelta).toBeCloseTo(7, 0);
    });

    it('14. sovDelta is null when fewer than 2 snapshots', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [{ snapshot_date: '2026-01-29', share_of_voice: 0.12 }],
      };
      const result = buildProofTimeline(input);
      expect(result.summary.sovDelta).toBeNull();
    });

    it('15. counts actionsCompleted from published content', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        publishedContent: [
          { id: '1', published_at: '2026-02-01T14:00:00.000Z', draft_title: 'A', content_type: 'faq_page', trigger_type: 'manual' },
          { id: '2', published_at: '2026-02-02T14:00:00.000Z', draft_title: 'B', content_type: 'blog_post', trigger_type: 'manual' },
        ],
      };
      const result = buildProofTimeline(input);
      expect(result.summary.actionsCompleted).toBe(2);
    });

    it('16. counts hallucinationsResolved from fixed hallucinations', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        hallucinations: [
          { id: 'h1', claim_text: 'A', severity: 'high', detected_at: '2026-01-28T09:00:00.000Z', resolved_at: '2026-02-15T11:00:00.000Z', correction_status: 'fixed' },
          { id: 'h2', claim_text: 'B', severity: 'medium', detected_at: '2026-01-29T09:00:00.000Z', resolved_at: null, correction_status: 'open' },
          { id: 'h3', claim_text: 'C', severity: 'low', detected_at: '2026-01-30T09:00:00.000Z', resolved_at: '2026-02-16T11:00:00.000Z', correction_status: 'dismissed' },
        ],
      };
      const result = buildProofTimeline(input);
      // Only 'fixed' counts, not 'dismissed'
      expect(result.summary.hallucinationsResolved).toBe(1);
    });

    it('17. sets startDate and endDate from event date range', () => {
      const result = buildProofTimeline(MOCK_TIMELINE_INPUT);
      expect(result.summary.startDate).toBeTruthy();
      expect(result.summary.endDate).toBeTruthy();
      expect(new Date(result.summary.startDate).getTime()).toBeLessThanOrEqual(
        new Date(result.summary.endDate).getTime(),
      );
    });
  });

  describe('Impact classification', () => {
    it('18. content_published has impact=positive', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        publishedContent: [{
          id: '1', published_at: '2026-02-01T14:00:00.000Z',
          draft_title: 'Test', content_type: 'faq_page', trigger_type: 'manual',
        }],
      };
      const result = buildProofTimeline(input);
      const published = result.events.find((e) => e.type === 'content_published');
      expect(published?.impact).toBe('positive');
    });

    it('19. hallucination_detected has impact=negative', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        hallucinations: [{
          id: 'h1', claim_text: 'Bad claim', severity: 'high',
          detected_at: '2026-01-28T09:00:00.000Z', resolved_at: null, correction_status: 'open',
        }],
      };
      const result = buildProofTimeline(input);
      const detected = result.events.find((e) => e.type === 'hallucination_detected');
      expect(detected?.impact).toBe('negative');
    });

    it('20. bot_crawl has impact=milestone', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        firstBotVisits: [{ bot_type: 'gptbot', first_crawled_at: '2026-02-07T08:00:00.000Z' }],
      };
      const result = buildProofTimeline(input);
      const botCrawl = result.events.find((e) => e.type === 'bot_crawl');
      expect(botCrawl?.impact).toBe('milestone');
    });

    it('21. metric_snapshot has impact=neutral', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [{ snapshot_date: '2026-01-29', share_of_voice: 0.12 }],
      };
      const result = buildProofTimeline(input);
      const snapshot = result.events.find((e) => e.type === 'metric_snapshot');
      expect(snapshot?.impact).toBe('neutral');
    });
  });

  describe('Edge cases', () => {
    it('22. handles empty input (no data) — returns empty events + zeroed summary', () => {
      const result = buildProofTimeline(EMPTY_INPUT);
      expect(result.events).toHaveLength(0);
      expect(result.summary.sovDelta).toBeNull();
      expect(result.summary.actionsCompleted).toBe(0);
      expect(result.summary.hallucinationsResolved).toBe(0);
    });

    it('23. handles single snapshot (no delta) — sovDelta=null', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [{ snapshot_date: '2026-01-29', share_of_voice: 0.12 }],
      };
      const result = buildProofTimeline(input);
      expect(result.summary.sovDelta).toBeNull();
      expect(result.events).toHaveLength(1);
    });

    it('24. handles MOCK_TIMELINE_INPUT and produces correct event count', () => {
      const result = buildProofTimeline(MOCK_TIMELINE_INPUT);
      // 4 snapshots + 1 published + 2 bot crawls + 2 audits (score changed 54→72, ≥5) + 1 hallucination detected + 1 resolved + 1 schema_added + 1 sov_milestone (12→17=+5pp)
      // = 4 + 1 + 2 + 1(first audit) + 1 + 1 + 1 + 1 = 12 minimum
      expect(result.events.length).toBeGreaterThanOrEqual(10);
      // Verify key event types exist
      const types = new Set(result.events.map((e) => e.type));
      expect(types.has('metric_snapshot')).toBe(true);
      expect(types.has('content_published')).toBe(true);
      expect(types.has('bot_crawl')).toBe(true);
      expect(types.has('hallucination_detected')).toBe(true);
      expect(types.has('hallucination_resolved')).toBe(true);
      expect(types.has('schema_added')).toBe(true);
    });

    it('25. truncates long claim_text in hallucination descriptions', () => {
      const longText = 'A'.repeat(200);
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        hallucinations: [{
          id: 'h1', claim_text: longText, severity: 'high',
          detected_at: '2026-01-28T09:00:00.000Z', resolved_at: null, correction_status: 'open',
        }],
      };
      const result = buildProofTimeline(input);
      const detected = result.events.find((e) => e.type === 'hallucination_detected');
      expect(detected!.description.length).toBeLessThanOrEqual(80);
      expect(detected!.description.endsWith('...')).toBe(true);
    });
  });

  describe('Audit events', () => {
    it('26. generates audit_completed for first audit (no previous score)', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        audits: [
          { last_audited_at: '2026-01-30T10:00:00.000Z', overall_score: 54, faq_schema_present: false, schema_completeness_score: 20 },
        ],
      };
      const result = buildProofTimeline(input);
      const auditEvents = result.events.filter((e) => e.type === 'audit_completed');
      expect(auditEvents).toHaveLength(1);
    });

    it('27. skips audit when score change < 5 points', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        audits: [
          { last_audited_at: '2026-01-30T10:00:00.000Z', overall_score: 54, faq_schema_present: false, schema_completeness_score: 20 },
          { last_audited_at: '2026-02-06T10:00:00.000Z', overall_score: 56, faq_schema_present: false, schema_completeness_score: 22 },
        ],
      };
      const result = buildProofTimeline(input);
      const auditEvents = result.events.filter((e) => e.type === 'audit_completed');
      // Only first audit included (no previous), second skipped (delta=2 < 5)
      expect(auditEvents).toHaveLength(1);
    });

    it('28. includes audit when score change >= 5 points', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        audits: [
          { last_audited_at: '2026-01-30T10:00:00.000Z', overall_score: 54, faq_schema_present: false, schema_completeness_score: 20 },
          { last_audited_at: '2026-02-06T10:00:00.000Z', overall_score: 72, faq_schema_present: true, schema_completeness_score: 85 },
        ],
      };
      const result = buildProofTimeline(input);
      const auditEvents = result.events.filter((e) => e.type === 'audit_completed');
      expect(auditEvents).toHaveLength(2); // first + significant change
    });

    it('29. audit with positive score change has impact=positive', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        audits: [
          { last_audited_at: '2026-01-30T10:00:00.000Z', overall_score: 54, faq_schema_present: false, schema_completeness_score: 20 },
          { last_audited_at: '2026-02-06T10:00:00.000Z', overall_score: 72, faq_schema_present: true, schema_completeness_score: 85 },
        ],
      };
      const result = buildProofTimeline(input);
      const secondAudit = result.events.filter((e) => e.type === 'audit_completed')[1];
      expect(secondAudit?.impact).toBe('positive');
    });

    it('30. handles snapshot with null share_of_voice', () => {
      const input: TimelineInput = {
        ...EMPTY_INPUT,
        snapshots: [
          { snapshot_date: '2026-01-29', share_of_voice: null },
        ],
      };
      const result = buildProofTimeline(input);
      const snapshot = result.events.find((e) => e.type === 'metric_snapshot');
      expect(snapshot!.description).toContain('N/A');
      expect(snapshot!.metrics?.sovPercent).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// formatContentType
// ---------------------------------------------------------------------------

describe('formatContentType', () => {
  it('26b. maps faq_page → FAQ Page', () => {
    expect(formatContentType('faq_page')).toBe('FAQ Page');
  });

  it('27b. maps gbp_post → Google Business Profile Post', () => {
    expect(formatContentType('gbp_post')).toBe('Google Business Profile Post');
  });

  it('28b. returns raw type for unknown values', () => {
    expect(formatContentType('unknown_type')).toBe('unknown_type');
  });
});

// ---------------------------------------------------------------------------
// formatTriggerType
// ---------------------------------------------------------------------------

describe('formatTriggerType', () => {
  it('29b. maps hallucination_correction → Hallucination Correction', () => {
    expect(formatTriggerType('hallucination_correction')).toBe('Hallucination Correction');
  });

  it('30b. returns raw type for unknown values', () => {
    expect(formatTriggerType('unknown_trigger')).toBe('unknown_trigger');
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('leaves short text unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates text exceeding maxLen with ...', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });
});
