// ---------------------------------------------------------------------------
// lib/vaio/score-card-helpers.ts — Pure helper functions for the VAIO score card
//
// Sprint §208: VAIO Score Foundation
// Extracted from VAIOPageClient so they can be unit-tested independently.
// ---------------------------------------------------------------------------

import type { ScoreBreakdown } from './types';

export const VOICE_SCORE_MAX: Record<keyof ScoreBreakdown, number> = {
  llms_txt:        25,
  crawler_access:  25,
  voice_citation:  30,
  content_quality: 20,
};

// Milestone thresholds: 70 = Well-Optimized, 100 = Voice Champion
const MILESTONES = [
  { threshold: 70,  label: 'Well-Optimized' },
  { threshold: 100, label: 'Voice Champion' },
] as const;

// ---------------------------------------------------------------------------
// getMilestoneLabel
// Returns the "X pts to [milestone]" or completion string.
// ---------------------------------------------------------------------------

export function getMilestoneLabel(score: number): string {
  if (score >= 100) return "You've reached Voice Champion";
  if (score >= 70) return `${100 - score} pts to Voice Champion`;
  return `${70 - score} pts to Well-Optimized`;
}

// ---------------------------------------------------------------------------
// getWeakestComponent
// Returns the key of the component with the lowest earned/max ratio.
// ---------------------------------------------------------------------------

export function getWeakestComponent(breakdown: ScoreBreakdown): keyof ScoreBreakdown {
  type Entry = { key: keyof ScoreBreakdown; ratio: number };
  const entries: Entry[] = [
    { key: 'llms_txt',        ratio: breakdown.llms_txt        / VOICE_SCORE_MAX.llms_txt },
    { key: 'crawler_access',  ratio: breakdown.crawler_access  / VOICE_SCORE_MAX.crawler_access },
    { key: 'voice_citation',  ratio: breakdown.voice_citation  / VOICE_SCORE_MAX.voice_citation },
    { key: 'content_quality', ratio: breakdown.content_quality / VOICE_SCORE_MAX.content_quality },
  ];
  return entries.reduce((a, b) => (a.ratio <= b.ratio ? a : b)).key;
}

// ---------------------------------------------------------------------------
// getCoachingMessage
// Returns a personalised message based on the weakest component.
// Falls back to the static ternary when breakdown is null.
// ---------------------------------------------------------------------------

export function getCoachingMessage(breakdown: ScoreBreakdown | null, score: number): string {
  if (!breakdown) {
    if (score >= 70) return 'Your business is well-optimized for voice search.';
    if (score >= 40) return 'Some improvements needed for voice search readiness.';
    return 'Voice search optimization needs attention.';
  }

  const weakest = getWeakestComponent(breakdown);
  const pts = VOICE_SCORE_MAX[weakest] - breakdown[weakest];

  switch (weakest) {
    case 'crawler_access':
      return `Your content is strong. AI bots can't read it yet. One robots.txt change could unlock +${pts} pts.`;
    case 'llms_txt':
      return `AI assistants don't have a structured profile for your business. Generate your AI Business Profile to unlock +${pts} pts.`;
    case 'voice_citation':
      return `AI knows who you are but rarely recommends you for voice queries. Fix your content gaps to unlock +${pts} pts.`;
    case 'content_quality':
      return `Your voice content isn't formatted for spoken answers. Short sentences and local keywords unlock +${pts} pts.`;
  }
}

// ---------------------------------------------------------------------------
// getRevenueStakesLine
// Returns the revenue context sentence shown below the coaching message.
// ---------------------------------------------------------------------------

export const MONTHLY_QUERY_MULTIPLIER = 4.3;

export function getRevenueStakesLine(
  voiceCitationRate: number | null | undefined,
  voiceQueriesTracked: number | null | undefined,
): string {
  if (!voiceCitationRate || voiceCitationRate <= 0) {
    return 'AI assistants are not yet recommending your business for voice queries.';
  }
  const n = Math.round(voiceCitationRate * (voiceQueriesTracked ?? 0) * MONTHLY_QUERY_MULTIPLIER);
  return `At your current citation rate, an estimated ${n} voice-driven visits reach you each month. Businesses at 70+ see 3× that.`;
}

// ---------------------------------------------------------------------------
// Bar items descriptor (order matches spec: crawlers first)
// ---------------------------------------------------------------------------

export interface BarItem {
  key: keyof ScoreBreakdown;
  label: string;
  max: number;
}

export const SCORE_BAR_ITEMS: BarItem[] = [
  { key: 'crawler_access',  label: 'AI Crawlers',      max: 25 },
  { key: 'llms_txt',        label: 'AI Profile',        max: 25 },
  { key: 'voice_citation',  label: 'AI Citations',      max: 30 },
  { key: 'content_quality', label: 'Content Quality',   max: 20 },
];

export function barColor(earned: number, max: number): string {
  const ratio = earned / max;
  if (ratio >= 0.8) return 'bg-green-500';
  if (ratio >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}
