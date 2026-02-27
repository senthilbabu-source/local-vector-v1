// ---------------------------------------------------------------------------
// content-calendar.service.ts — Sprint 83: Proactive Content Calendar
//
// Pure functions that generate time-bucketed, urgency-scored content
// recommendations from 5 signal sources: occasions, SOV gaps, page
// freshness, competitor gaps, and hallucination corrections.
//
// Zero I/O. Zero AI calls. All deterministic.
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────

export type RecommendationType =
  | 'occasion'
  | 'sov_gap'
  | 'freshness_update'
  | 'competitor_gap'
  | 'hallucination_fix';

export type TimeBucket = 'this_week' | 'next_week' | 'two_weeks' | 'later';

export type ActionVerb = 'publish' | 'update' | 'create';

export interface ContentRecommendation {
  /** Unique key for deduplication */
  key: string;
  /** What to do */
  action: ActionVerb;
  /** Recommended title / topic */
  title: string;
  /** Human-readable reason backed by data */
  reason: string;
  /** Which signal generated this */
  type: RecommendationType;
  /** Urgency score 0-100 (higher = more urgent) */
  urgency: number;
  /** When to do it */
  timeBucket: TimeBucket;
  /** Days until this becomes critical (null = no deadline) */
  daysUntilDeadline: number | null;
  /** Suggested content_type for the draft */
  suggestedContentType: string;
  /** CTA links */
  ctas: Array<{ label: string; href: string }>;
  /** Source data reference for traceability */
  sourceId: string | null;
}

export interface ContentCalendarResult {
  thisWeek: ContentRecommendation[];
  nextWeek: ContentRecommendation[];
  twoWeeks: ContentRecommendation[];
  later: ContentRecommendation[];
  totalCount: number;
  signalSummary: {
    occasionCount: number;
    sovGapCount: number;
    freshnessCount: number;
    competitorGapCount: number;
    hallucinationFixCount: number;
  };
}

// ── Input types ───────────────────────────────────────

export interface CalendarInput {
  businessName: string;
  locationId: string;

  /** Signal 1: Upcoming occasions within trigger window */
  occasions: Array<{
    id: string;
    name: string;
    occasionType: string;
    annualDate: string | null;
    triggerDaysBefore: number;
    peakQueryPatterns: string[];
  }>;

  /** Signal 2: SOV gap queries (rank_position IS NULL across engines) */
  sovGaps: Array<{
    queryId: string;
    queryText: string;
    queryCategory: string;
    missingEngineCount: number;
    totalEngineCount: number;
  }>;

  /** Signal 3: Stale pages (not audited/updated recently) */
  stalePages: Array<{
    pageUrl: string;
    pageType: string;
    lastAuditedAt: string;
    overallScore: number | null;
    daysSinceAudit: number;
  }>;

  /** Signal 3b: Stale menu */
  staleMenu: {
    menuId: string;
    lastUpdatedAt: string;
    daysSinceUpdate: number;
    recentBotVisitCount: number;
    previousBotVisitCount: number;
  } | null;

  /** Signal 4: Pending competitor gap actions */
  competitorGaps: Array<{
    id: string;
    competitorName: string;
    queryAsked: string;
    winningFactor: string | null;
    suggestedAction: string | null;
    gapMagnitude: string | null;
  }>;

  /** Signal 5: Open hallucinations needing correction content */
  openHallucinations: Array<{
    id: string;
    claimText: string;
    severity: string;
    modelProvider: string;
  }>;

  /** Existing drafts (to filter out already-addressed recommendations) */
  existingDraftTriggerIds: Set<string>;
}

// ── Pure computation ──────────────────────────────────

/**
 * Generate the proactive content calendar from all signal sources.
 * Pure function — no I/O, no side effects.
 */
export function generateContentCalendar(
  input: CalendarInput,
): ContentCalendarResult {
  const recommendations: ContentRecommendation[] = [];

  recommendations.push(...generateOccasionRecommendations(input));
  recommendations.push(...generateSOVGapRecommendations(input));
  recommendations.push(...generateFreshnessRecommendations(input));
  recommendations.push(...generateCompetitorGapRecommendations(input));
  recommendations.push(...generateHallucinationFixRecommendations(input));

  // Filter out recommendations for which drafts already exist
  const filtered = recommendations.filter(
    (r) => !r.sourceId || !input.existingDraftTriggerIds.has(r.sourceId),
  );

  const deduped = deduplicateByKey(filtered);
  const buckets = groupByTimeBucket(deduped);

  return {
    thisWeek: buckets.this_week,
    nextWeek: buckets.next_week,
    twoWeeks: buckets.two_weeks,
    later: buckets.later,
    totalCount: deduped.length,
    signalSummary: {
      occasionCount: deduped.filter((r) => r.type === 'occasion').length,
      sovGapCount: deduped.filter((r) => r.type === 'sov_gap').length,
      freshnessCount: deduped.filter((r) => r.type === 'freshness_update').length,
      competitorGapCount: deduped.filter((r) => r.type === 'competitor_gap').length,
      hallucinationFixCount: deduped.filter((r) => r.type === 'hallucination_fix').length,
    },
  };
}

// ── Signal generators ─────────────────────────────────

export function generateOccasionRecommendations(
  input: CalendarInput,
): ContentRecommendation[] {
  const today = new Date();
  return input.occasions.map((occasion) => {
    const daysUntilPeak =
      occasion.annualDate !== null
        ? computeDaysUntilDate(occasion.annualDate, today)
        : null;

    const urgency =
      daysUntilPeak !== null
        ? Math.max(0, Math.min(95, 100 - daysUntilPeak * 2))
        : 50;

    const timeBucket = assignTimeBucket(daysUntilPeak ?? 14);

    return {
      key: `occasion:${occasion.id}`,
      action: 'publish' as const,
      title: `${occasion.name} content for ${input.businessName}`,
      reason:
        daysUntilPeak !== null
          ? `Occasion Engine: ${occasion.name} queries peak in ${daysUntilPeak} days`
          : `Upcoming ${occasion.occasionType}: ${occasion.name}`,
      type: 'occasion' as const,
      urgency,
      timeBucket,
      daysUntilDeadline: daysUntilPeak,
      suggestedContentType: 'occasion_page',
      ctas: [
        {
          label: 'Create Draft →',
          href: `/dashboard/content-drafts?trigger_type=occasion&trigger_id=${occasion.id}`,
        },
      ],
      sourceId: occasion.id,
    };
  });
}

export function generateSOVGapRecommendations(
  input: CalendarInput,
): ContentRecommendation[] {
  return input.sovGaps
    .sort((a, b) => b.missingEngineCount - a.missingEngineCount)
    .slice(0, 5)
    .map((gap) => {
      const gapRatio =
        gap.totalEngineCount > 0
          ? gap.missingEngineCount / gap.totalEngineCount
          : 1;
      const urgency = Math.round(gapRatio * 80);

      return {
        key: `sov_gap:${gap.queryId}`,
        action: 'create' as const,
        title: `Content targeting "${gap.queryText}"`,
        reason: `SOV Gap: Not ranked by ${gap.missingEngineCount} of ${gap.totalEngineCount} AI engines for "${gap.queryText}"`,
        type: 'sov_gap' as const,
        urgency,
        timeBucket: 'next_week' as const,
        daysUntilDeadline: null,
        suggestedContentType:
          gap.queryCategory === 'occasion' ? 'occasion_page' : 'blog_post',
        ctas: [
          {
            label: 'View Content Brief →',
            href: `/dashboard/content-drafts?trigger_type=prompt_missing&query=${encodeURIComponent(gap.queryText)}`,
          },
        ],
        sourceId: gap.queryId,
      };
    });
}

export function generateFreshnessRecommendations(
  input: CalendarInput,
): ContentRecommendation[] {
  const recs: ContentRecommendation[] = [];

  for (const page of input.stalePages) {
    if (page.daysSinceAudit < 30) continue;

    const urgency = Math.min(85, 40 + page.daysSinceAudit);

    recs.push({
      key: `freshness:${page.pageUrl}`,
      action: 'update' as const,
      title: `Update ${page.pageType} page`,
      reason: `Last audited ${page.daysSinceAudit} days ago${page.overallScore !== null ? ` (score: ${page.overallScore}/100)` : ''}`,
      type: 'freshness_update' as const,
      urgency,
      timeBucket: page.daysSinceAudit > 60 ? 'this_week' : 'next_week',
      daysUntilDeadline: null,
      suggestedContentType:
        page.pageType === 'faq' ? 'faq_page' : 'landing_page',
      ctas: [{ label: 'Re-Audit Page →', href: '/dashboard/page-audits' }],
      sourceId: null,
    });
  }

  if (input.staleMenu && input.staleMenu.daysSinceUpdate > 30) {
    const botDecline =
      input.staleMenu.previousBotVisitCount > 0
        ? Math.round(
            ((input.staleMenu.previousBotVisitCount -
              input.staleMenu.recentBotVisitCount) /
              input.staleMenu.previousBotVisitCount) *
              100,
          )
        : 0;

    const urgency = Math.min(90, 50 + input.staleMenu.daysSinceUpdate);

    recs.push({
      key: 'freshness:menu',
      action: 'update' as const,
      title: 'Update menu page',
      reason: `Menu last updated ${input.staleMenu.daysSinceUpdate} days ago${botDecline > 0 ? ` — AI bot visits dropped ${botDecline}%` : ''}`,
      type: 'freshness_update' as const,
      urgency,
      timeBucket:
        input.staleMenu.daysSinceUpdate > 45 ? 'this_week' : 'next_week',
      daysUntilDeadline: null,
      suggestedContentType: 'landing_page',
      ctas: [{ label: 'Update Menu →', href: '/dashboard/menus' }],
      sourceId: input.staleMenu.menuId,
    });
  }

  return recs;
}

export function generateCompetitorGapRecommendations(
  input: CalendarInput,
): ContentRecommendation[] {
  return input.competitorGaps.slice(0, 3).map((gap) => {
    const urgency =
      gap.gapMagnitude === 'large'
        ? 70
        : gap.gapMagnitude === 'medium'
          ? 55
          : 40;

    return {
      key: `competitor:${gap.id}`,
      action: 'create' as const,
      title: gap.suggestedAction
        ? truncate(gap.suggestedAction, 80)
        : `Address competitive gap vs ${gap.competitorName}`,
      reason: `${gap.competitorName} winning on "${truncate(gap.queryAsked ?? '', 50)}"${gap.winningFactor ? ` — factor: ${gap.winningFactor}` : ''}`,
      type: 'competitor_gap' as const,
      urgency,
      timeBucket: 'two_weeks' as const,
      daysUntilDeadline: null,
      suggestedContentType: 'blog_post',
      ctas: [
        { label: 'View Gap Analysis →', href: '/dashboard/competitors' },
      ],
      sourceId: gap.id,
    };
  });
}

export function generateHallucinationFixRecommendations(
  input: CalendarInput,
): ContentRecommendation[] {
  return input.openHallucinations.slice(0, 3).map((h) => {
    const urgency =
      h.severity === 'critical' ? 90 : h.severity === 'high' ? 75 : 55;

    return {
      key: `hallucination:${h.id}`,
      action: 'create' as const,
      title: `Correction content: "${truncate(h.claimText, 60)}"`,
      reason: `${formatProvider(h.modelProvider)} is spreading this inaccuracy — publish correction content`,
      type: 'hallucination_fix' as const,
      urgency,
      timeBucket: urgency >= 75 ? 'this_week' : 'next_week',
      daysUntilDeadline: null,
      suggestedContentType: 'blog_post',
      ctas: [
        { label: 'Generate Correction →', href: '/dashboard/hallucinations' },
      ],
      sourceId: h.id,
    };
  });
}

// ── Helpers (exported for unit testing) ───────────────

export function computeDaysUntilDate(
  annualDate: string,
  today: Date,
): number {
  const [month, day] = annualDate.split('-').map(Number);
  const thisYear = today.getFullYear();

  let target = new Date(thisYear, month! - 1, day);
  if (target < today) {
    target = new Date(thisYear + 1, month! - 1, day);
  }

  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function assignTimeBucket(daysOut: number): TimeBucket {
  if (daysOut <= 7) return 'this_week';
  if (daysOut <= 14) return 'next_week';
  if (daysOut <= 21) return 'two_weeks';
  return 'later';
}

function deduplicateByKey(
  recs: ContentRecommendation[],
): ContentRecommendation[] {
  const seen = new Map<string, ContentRecommendation>();
  for (const r of recs) {
    const existing = seen.get(r.key);
    if (!existing || r.urgency > existing.urgency) {
      seen.set(r.key, r);
    }
  }
  return [...seen.values()];
}

function groupByTimeBucket(
  recs: ContentRecommendation[],
): Record<TimeBucket, ContentRecommendation[]> {
  const buckets: Record<TimeBucket, ContentRecommendation[]> = {
    this_week: [],
    next_week: [],
    two_weeks: [],
    later: [],
  };
  for (const r of recs) {
    buckets[r.timeBucket].push(r);
  }
  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => b.urgency - a.urgency);
  }
  return buckets;
}

export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

export function formatProvider(provider: string): string {
  const map: Record<string, string> = {
    'openai-gpt4o': 'GPT-4o',
    'openai-gpt4o-mini': 'GPT-4o mini',
    'perplexity-sonar': 'Perplexity',
    'google-gemini': 'Gemini',
    'anthropic-claude': 'Claude',
    'microsoft-copilot': 'Copilot',
  };
  return map[provider] ?? provider;
}
