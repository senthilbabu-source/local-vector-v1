// ---------------------------------------------------------------------------
// lib/services/weekly-digest.service.ts — Weekly AI Snapshot Digest Builder
//
// Sprint 78: Pure payload builder that assembles digest email content from
// raw data. No I/O, no Resend calls, no Supabase — pure functions only
// (AI_RULES §39).
//
// Input:  DigestDataInput  — raw data gathered from multiple tables
// Output: DigestPayload    — structured email payload for React Email render
// ---------------------------------------------------------------------------

// ── Input: Raw data gathered from multiple tables ──────

export interface DigestDataInput {
  org: {
    id: string;
    name: string;
  };
  owner: {
    email: string;
    full_name: string | null;
  };
  location: {
    business_name: string;
    city: string;
    state: string;
  };

  /** Current week's AI Health Score (Sprint 72) */
  currentHealthScore: number | null;
  /** Previous week's AI Health Score (for delta) */
  previousHealthScore: number | null;

  /** Current SOV percentage (0–1 float) */
  currentSov: number | null;
  /** Previous SOV percentage (0–1 float) */
  previousSov: number | null;

  /** New hallucinations detected this week */
  newHallucinations: Array<{
    claim_text: string;
    severity: string;
    model_provider: string;
  }>;

  /** Hallucinations resolved this week */
  resolvedHallucinations: number;

  /** New SOV wins this week (first-time mentions) */
  sovWins: Array<{
    query_text: string;
    engine: string;
  }>;

  /** Top recommendation from AI Health Score (Sprint 72) */
  topRecommendation: {
    title: string;
    description: string;
    href: string;
    estimatedImpact: number;
  } | null;

  /** Bot activity summary (Sprint 73) */
  botVisitsThisWeek: number;
  newBlindSpots: number;
}

// ── Output: Rendered digest payload ────────────────────

export interface DigestPayload {
  recipientEmail: string;
  recipientName: string;
  businessName: string;
  subject: string;

  /** AI Health Score section */
  healthScore: {
    current: number | null;
    delta: number | null;
    trend: 'up' | 'down' | 'flat' | 'new';
  };

  /** SOV section */
  sov: {
    currentPercent: number | null;
    delta: number | null;
    trend: 'up' | 'down' | 'flat' | 'new';
  };

  /** Issues section — new hallucinations this week */
  issues: Array<{
    emoji: string;
    text: string;
    cta: { label: string; href: string };
  }>;

  /** Wins section — positive changes */
  wins: Array<{
    emoji: string;
    text: string;
  }>;

  /** Opportunities — actions the user can take */
  opportunities: Array<{
    emoji: string;
    text: string;
    cta: { label: string; href: string };
  }>;

  /** Bot activity summary line */
  botSummary: string | null;

  /** Dashboard CTA URL */
  dashboardUrl: string;

  /** Unsubscribe URL */
  unsubscribeUrl: string;
}

// ── Helpers ────────────────────────────────────────────

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
  };
  return map[provider] ?? provider;
}

export function formatEngine(engine: string): string {
  const map: Record<string, string> = {
    perplexity: 'Perplexity',
    openai: 'ChatGPT',
    google: 'Google AI Overview',
  };
  return map[engine] ?? engine;
}

// ── Main builder ───────────────────────────────────────

/**
 * Pure function — builds the digest email payload from raw data.
 * No I/O, no side effects.
 */
export function buildDigestPayload(input: DigestDataInput): DigestPayload {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';

  // ── Subject line ──
  const scorePart =
    input.currentHealthScore !== null
      ? `AI Health: ${input.currentHealthScore}`
      : 'Your AI Snapshot';
  const deltaPart =
    input.currentHealthScore !== null && input.previousHealthScore !== null
      ? ` (${input.currentHealthScore >= input.previousHealthScore ? '+' : ''}${input.currentHealthScore - input.previousHealthScore})`
      : '';
  const subject = `${scorePart}${deltaPart} — ${input.location.business_name} Weekly`;

  // ── Health Score trend ──
  const healthDelta =
    input.currentHealthScore !== null && input.previousHealthScore !== null
      ? input.currentHealthScore - input.previousHealthScore
      : null;
  const healthTrend: DigestPayload['healthScore']['trend'] =
    input.currentHealthScore === null
      ? 'new'
      : healthDelta === null
        ? 'new'
        : healthDelta > 0
          ? 'up'
          : healthDelta < 0
            ? 'down'
            : 'flat';

  // ── SOV trend ──
  const sovDelta =
    input.currentSov !== null && input.previousSov !== null
      ? (input.currentSov - input.previousSov) * 100
      : null;
  const sovTrend: DigestPayload['sov']['trend'] =
    input.currentSov === null
      ? 'new'
      : sovDelta === null
        ? 'new'
        : sovDelta > 0
          ? 'up'
          : sovDelta < 0
            ? 'down'
            : 'flat';

  // ── Issues ──
  const issues = input.newHallucinations.map((h) => ({
    emoji: h.severity === 'critical' ? '🔴' : h.severity === 'high' ? '🟠' : '🟡',
    text: `${formatProvider(h.model_provider)} claims: "${truncate(h.claim_text, 60)}"`,
    cta: { label: 'Fix This →', href: `${baseUrl}/dashboard` },
  }));

  // ── Wins ──
  const wins: DigestPayload['wins'] = [];
  if (input.resolvedHallucinations > 0) {
    wins.push({
      emoji: '✅',
      text: `${input.resolvedHallucinations} hallucination${input.resolvedHallucinations > 1 ? 's' : ''} resolved this week`,
    });
  }
  for (const w of input.sovWins) {
    wins.push({
      emoji: '🟢',
      text: `${formatEngine(w.engine)} now mentions you for "${truncate(w.query_text, 50)}" — first time!`,
    });
  }
  if (healthDelta !== null && healthDelta > 0) {
    wins.push({
      emoji: '📈',
      text: `AI Health Score improved by ${healthDelta} points`,
    });
  }

  // ── Opportunities ──
  const opportunities: DigestPayload['opportunities'] = [];
  if (input.topRecommendation) {
    opportunities.push({
      emoji: '💡',
      text: `${input.topRecommendation.title} — est. +${input.topRecommendation.estimatedImpact} pts`,
      cta: { label: 'Take Action →', href: `${baseUrl}${input.topRecommendation.href}` },
    });
  }
  if (input.newBlindSpots > 0) {
    opportunities.push({
      emoji: '🔍',
      text: `${input.newBlindSpots} AI engine${input.newBlindSpots > 1 ? 's' : ''} can't see your content`,
      cta: { label: 'View Blind Spots →', href: `${baseUrl}/dashboard/crawler-analytics` },
    });
  }

  // ── Bot summary ──
  const botSummary =
    input.botVisitsThisWeek > 0
      ? `🤖 ${input.botVisitsThisWeek} AI bot visit${input.botVisitsThisWeek > 1 ? 's' : ''} this week`
      : null;

  return {
    recipientEmail: input.owner.email,
    recipientName: input.owner.full_name ?? input.owner.email.split('@')[0],
    businessName: input.location.business_name,
    subject,
    healthScore: {
      current: input.currentHealthScore,
      delta: healthDelta,
      trend: healthTrend,
    },
    sov: {
      currentPercent: input.currentSov !== null ? input.currentSov * 100 : null,
      delta: sovDelta,
      trend: sovTrend,
    },
    issues,
    wins,
    opportunities,
    botSummary,
    dashboardUrl: `${baseUrl}/dashboard`,
    unsubscribeUrl: `${baseUrl}/dashboard/settings`,
  };
}
