// ---------------------------------------------------------------------------
// lib/services/proof-timeline.service.ts — Before/After Proof Timeline Builder
//
// Sprint 77: Pure function that builds a chronological timeline correlating
// user actions with measurable outcomes. No I/O, no Supabase, no side effects.
//
// Takes raw data from 5 existing tables (visibility_analytics, page_audits,
// content_drafts, crawler_hits, ai_hallucinations) and produces a timeline
// of events with summary stats showing cause → effect.
// ---------------------------------------------------------------------------

// ── Event Types ────────────────────────────────────────────

export type TimelineEventType =
  | 'metric_snapshot'
  | 'content_published'
  | 'bot_crawl'
  | 'audit_completed'
  | 'hallucination_detected'
  | 'hallucination_resolved'
  | 'schema_added'
  | 'sov_milestone';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  title: string;
  description: string;
  icon: string;
  impact: 'positive' | 'negative' | 'neutral' | 'milestone';

  /** Metric values AT this point in time (for charting) */
  metrics?: {
    sovPercent?: number;
    healthScore?: number;
    pageAuditScore?: number;
  };
}

export interface ProofTimeline {
  events: TimelineEvent[];

  /** Summary stats for the header */
  summary: {
    startDate: string;
    endDate: string;
    sovDelta: number | null;
    healthScoreDelta: number | null;
    actionsCompleted: number;
    hallucinationsResolved: number;
  };
}

// ── Input (raw data from multiple tables) ──────────────────

export interface TimelineInput {
  /** visibility_analytics rows ordered by snapshot_date ASC */
  snapshots: Array<{
    snapshot_date: string;
    share_of_voice: number | null;
  }>;

  /** page_audits rows with audit history */
  audits: Array<{
    last_audited_at: string;
    overall_score: number | null;
    faq_schema_present: boolean | null;
    schema_completeness_score: number | null;
  }>;

  /** content_drafts that were published */
  publishedContent: Array<{
    id: string;
    published_at: string;
    draft_title: string;
    content_type: string;
    trigger_type: string;
  }>;

  /** crawler_hits — first visit per bot_type */
  firstBotVisits: Array<{
    bot_type: string;
    first_crawled_at: string;
  }>;

  /** ai_hallucinations lifecycle events */
  hallucinations: Array<{
    id: string;
    claim_text: string;
    severity: string;
    detected_at: string | null;
    resolved_at: string | null;
    correction_status: string | null;
  }>;

  /** Optional health score snapshots */
  healthScores?: Array<{
    date: string;
    score: number;
  }>;
}

// ── Helper functions ───────────────────────────────────────

/** Truncate text to maxLen, appending "..." */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/** Format content_type for display */
export function formatContentType(type: string): string {
  const map: Record<string, string> = {
    faq_page: 'FAQ Page',
    occasion_page: 'Occasion Page',
    blog_post: 'Blog Post',
    landing_page: 'Landing Page',
    gbp_post: 'Google Business Profile Post',
  };
  return map[type] ?? type;
}

/** Format trigger_type for display */
export function formatTriggerType(type: string): string {
  const map: Record<string, string> = {
    competitor_gap: 'Competitor Gap',
    occasion: 'Local Occasion',
    prompt_missing: 'Missing Prompt',
    first_mover: 'First Mover Opportunity',
    manual: 'Manual',
    hallucination_correction: 'Hallucination Correction',
  };
  return map[type] ?? type;
}

/** Format bot_type to human-readable label */
export function formatBotLabel(botType: string): string {
  const map: Record<string, string> = {
    gptbot: 'GPTBot (ChatGPT)',
    'oai-searchbot': 'OAI-SearchBot (ChatGPT Search)',
    'chatgpt-user': 'ChatGPT-User (Browsing)',
    claudebot: 'ClaudeBot (Claude)',
    'google-extended': 'Google-Extended (Gemini)',
    perplexitybot: 'PerplexityBot (Perplexity)',
    'meta-external': 'Meta-External (Meta AI)',
    bytespider: 'Bytespider (TikTok)',
    amazonbot: 'Amazonbot (Amazon AI)',
    'applebot-extended': 'Applebot (Apple Intelligence)',
  };
  return map[botType] ?? botType;
}

// ── Summary builder ────────────────────────────────────────

function buildSummary(events: TimelineEvent[], input: TimelineInput): ProofTimeline['summary'] {
  const dates = events.map((e) => e.date).sort();
  const startDate = dates[0] ?? new Date().toISOString();
  const endDate = dates[dates.length - 1] ?? new Date().toISOString();

  // SOV delta: last snapshot SOV - first snapshot SOV
  const sovValues = input.snapshots
    .map((s) => s.share_of_voice)
    .filter((v): v is number => v !== null);
  const sovDelta =
    sovValues.length >= 2
      ? (sovValues[sovValues.length - 1] - sovValues[0]) * 100
      : null;

  // Health score delta (if provided)
  const healthScores = input.healthScores ?? [];
  const healthScoreDelta =
    healthScores.length >= 2
      ? healthScores[healthScores.length - 1].score - healthScores[0].score
      : null;

  // Actions completed: published content count
  const actionsCompleted = input.publishedContent.length;

  // Hallucinations resolved count
  const hallucinationsResolved = input.hallucinations.filter(
    (h) => h.correction_status === 'fixed',
  ).length;

  return {
    startDate,
    endDate,
    sovDelta,
    healthScoreDelta,
    actionsCompleted,
    hallucinationsResolved,
  };
}

// ── Main builder ───────────────────────────────────────────

/**
 * Pure function — builds a proof timeline from raw data.
 * No I/O, no side effects. All timeline events are derived from input data.
 */
export function buildProofTimeline(input: TimelineInput): ProofTimeline {
  const events: TimelineEvent[] = [];

  // 1. METRIC SNAPSHOTS — one per visibility_analytics row
  for (const snap of input.snapshots) {
    const sovPct =
      snap.share_of_voice !== null
        ? (snap.share_of_voice * 100).toFixed(0)
        : null;
    events.push({
      id: `metric-${snap.snapshot_date}`,
      type: 'metric_snapshot',
      date: snap.snapshot_date,
      title: 'Weekly AI Visibility Snapshot',
      description: `SOV: ${sovPct !== null ? `${sovPct}%` : 'N/A'}`,
      icon: '📊',
      impact: 'neutral',
      metrics: {
        sovPercent:
          snap.share_of_voice !== null
            ? snap.share_of_voice * 100
            : undefined,
      },
    });
  }

  // 2. CONTENT PUBLISHED — one per published draft
  for (const draft of input.publishedContent) {
    events.push({
      id: `content-${draft.id}`,
      type: 'content_published',
      date: draft.published_at,
      title: `Published: ${draft.draft_title}`,
      description: `${formatContentType(draft.content_type)} — triggered by ${formatTriggerType(draft.trigger_type)}`,
      icon: '📝',
      impact: 'positive',
    });
  }

  // 3. BOT CRAWLS — first visit per bot type
  for (const bot of input.firstBotVisits) {
    const label = formatBotLabel(bot.bot_type);
    events.push({
      id: `bot-${bot.bot_type}`,
      type: 'bot_crawl',
      date: bot.first_crawled_at,
      title: `${label} First Visit`,
      description: `${label} crawled your Magic Menu for the first time`,
      icon: '🤖',
      impact: 'milestone',
    });
  }

  // 4. AUDIT COMPLETED — audits with significant score changes
  let prevAuditScore: number | null = null;
  for (const audit of input.audits) {
    const currentScore = audit.overall_score;
    // Include if score changed by >= 5 points or it's the first audit
    if (
      currentScore !== null &&
      (prevAuditScore === null || Math.abs(currentScore - prevAuditScore) >= 5)
    ) {
      const delta =
        prevAuditScore !== null ? currentScore - prevAuditScore : null;
      const deltaStr =
        delta !== null
          ? ` (${delta >= 0 ? '+' : ''}${delta} from previous)`
          : '';
      events.push({
        id: `audit-${audit.last_audited_at}`,
        type: 'audit_completed',
        date: audit.last_audited_at,
        title: 'Page Audit Completed',
        description: `Overall score: ${currentScore}/100${deltaStr}`,
        icon: '🔍',
        impact:
          delta !== null && delta > 0
            ? 'positive'
            : delta !== null && delta < 0
              ? 'negative'
              : 'neutral',
        metrics: { pageAuditScore: currentScore },
      });
    }
    if (currentScore !== null) {
      prevAuditScore = currentScore;
    }
  }

  // 5. HALLUCINATION DETECTED
  for (const hall of input.hallucinations) {
    if (hall.detected_at) {
      events.push({
        id: `hall-detect-${hall.id}`,
        type: 'hallucination_detected',
        date: hall.detected_at,
        title: 'Hallucination Detected',
        description: truncate(hall.claim_text, 80),
        icon: '🐛',
        impact: 'negative',
      });
    }
  }

  // 6. HALLUCINATION RESOLVED
  for (const hall of input.hallucinations) {
    if (
      hall.resolved_at &&
      (hall.correction_status === 'fixed' ||
        hall.correction_status === 'dismissed')
    ) {
      events.push({
        id: `hall-resolve-${hall.id}`,
        type: 'hallucination_resolved',
        date: hall.resolved_at,
        title: 'Hallucination Resolved',
        description: `"${truncate(hall.claim_text, 60)}" — marked ${hall.correction_status}`,
        icon: '✅',
        impact: 'positive',
      });
    }
  }

  // 7. SCHEMA ADDED — detect first audit where faq_schema_present = true
  const firstFaqAudit = input.audits.find(
    (a) => a.faq_schema_present === true,
  );
  if (firstFaqAudit) {
    events.push({
      id: 'schema-faq-first',
      type: 'schema_added',
      date: firstFaqAudit.last_audited_at,
      title: 'FAQ Schema Added',
      description: 'FAQ schema detected on your page for the first time',
      icon: '🏗️',
      impact: 'milestone',
    });
  }

  // 8. SOV MILESTONES — detect first mention (SOV goes from 0 to >0)
  //    and significant jumps (>= 5 percentage points week-over-week)
  for (let i = 0; i < input.snapshots.length; i++) {
    const current = input.snapshots[i];
    const prev = i > 0 ? input.snapshots[i - 1] : null;

    if (current.share_of_voice === null) continue;

    // First mention: previous was 0 or null, current is > 0
    if (
      current.share_of_voice > 0 &&
      (prev === null ||
        prev.share_of_voice === null ||
        prev.share_of_voice === 0) &&
      i > 0
    ) {
      events.push({
        id: `sov-milestone-first-${current.snapshot_date}`,
        type: 'sov_milestone',
        date: current.snapshot_date,
        title: 'First AI Mention',
        description: `Your business appeared in AI responses for the first time — SOV: ${(current.share_of_voice * 100).toFixed(0)}%`,
        icon: '📈',
        impact: 'milestone',
      });
    }

    // Significant jump: >= 5 percentage points increase
    if (
      prev !== null &&
      prev.share_of_voice !== null &&
      prev.share_of_voice > 0
    ) {
      const delta =
        (current.share_of_voice - prev.share_of_voice) * 100;
      if (delta >= 5) {
        events.push({
          id: `sov-milestone-jump-${current.snapshot_date}`,
          type: 'sov_milestone',
          date: current.snapshot_date,
          title: 'SOV Milestone',
          description: `Share of Voice jumped +${delta.toFixed(0)}pp — from ${(prev.share_of_voice * 100).toFixed(0)}% to ${(current.share_of_voice * 100).toFixed(0)}%`,
          icon: '📈',
          impact: 'milestone',
        });
      }
    }
  }

  // Sort all events chronologically (oldest first)
  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Build summary
  const summary = buildSummary(events, input);

  return { events, summary };
}
