// ---------------------------------------------------------------------------
// lib/services/before-after.ts — S42: Before & After Timeline
//
// Pure functions that build a chronological story of fixed hallucinations.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineStep {
  date: string; // ISO string
  event: string;
  detail: string;
  type: 'detection' | 'action' | 'resolution';
}

export interface BeforeAfterStory {
  hallucinationId: string;
  steps: TimelineStep[];
  totalRecovered: number;
  daysToFix: number;
  category: string | null;
  modelProvider: string;
}

export interface ResolvedHallucination {
  id: string;
  claim_text: string;
  expected_truth: string | null;
  category: string | null;
  model_provider: string;
  severity: string;
  detected_at: string;
  fixed_at: string | null;
  revenue_recovered_monthly: number | null;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

const MODEL_DISPLAY: Record<string, string> = {
  'openai-gpt4o': 'ChatGPT',
  'perplexity-sonar': 'Perplexity',
  'google-gemini': 'Gemini',
  'anthropic-claude': 'Claude',
  'microsoft-copilot': 'Copilot',
};

function modelName(provider: string): string {
  return MODEL_DISPLAY[provider] ?? provider;
}

/**
 * Builds a before/after story from a resolved hallucination.
 */
export function buildBeforeAfterStory(h: ResolvedHallucination): BeforeAfterStory {
  const steps: TimelineStep[] = [];

  // Step 1: Detection
  steps.push({
    date: h.detected_at,
    event: 'Error detected',
    detail: `${modelName(h.model_provider)} said: "${h.claim_text}"`,
    type: 'detection',
  });

  // Step 2: Action (correction submitted)
  if (h.fixed_at) {
    steps.push({
      date: h.fixed_at,
      event: 'Correction submitted',
      detail: h.expected_truth
        ? `You corrected it to: "${h.expected_truth}"`
        : 'You submitted a correction',
      type: 'action',
    });
  }

  // Step 3: Resolution
  const resolutionDate = h.fixed_at ?? h.detected_at;
  steps.push({
    date: resolutionDate,
    event: 'Verified fixed',
    detail: h.expected_truth
      ? `${modelName(h.model_provider)} now says: "${h.expected_truth}"`
      : `${modelName(h.model_provider)} has updated its response`,
    type: 'resolution',
  });

  // Sort chronologically
  steps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Days to fix
  const detectedMs = new Date(h.detected_at).getTime();
  const fixedMs = h.fixed_at ? new Date(h.fixed_at).getTime() : detectedMs;
  const daysToFix = Math.max(0, Math.round((fixedMs - detectedMs) / (1000 * 60 * 60 * 24)));

  return {
    hallucinationId: h.id,
    steps,
    totalRecovered: h.revenue_recovered_monthly ?? 0,
    daysToFix,
    category: h.category,
    modelProvider: h.model_provider,
  };
}

/**
 * Formats days to fix as a human-readable string.
 */
export function formatDaysToFix(days: number): string {
  if (days === 0) return 'Same day';
  if (days === 1) return '1 day';
  return `${days} days`;
}

// ---------------------------------------------------------------------------
// I/O — Fetch resolved hallucinations with stories
// ---------------------------------------------------------------------------

/**
 * Returns resolved hallucinations with before/after stories.
 * Never throws — returns empty array on error.
 */
export async function getResolvedWithStories(
  supabase: SupabaseClient,
  orgId: string,
  limit = 5,
): Promise<BeforeAfterStory[]> {
  try {
    const { data } = await supabase
      .from('ai_hallucinations')
      .select('id, claim_text, expected_truth, category, model_provider, severity, detected_at, fixed_at, revenue_recovered_monthly' as 'id, claim_text, expected_truth, category, model_provider, severity, detected_at')
      .eq('org_id', orgId)
      .in('correction_status', ['fixed', 'corrected'])
      .not('fixed_at' as 'first_detected_at', 'is', null)
      .order('fixed_at' as 'first_detected_at', { ascending: false })
      .limit(limit);

    if (!data || data.length === 0) return [];

    return (data as unknown as ResolvedHallucination[]).map(buildBeforeAfterStory);
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'before-after', sprint: 'S42' } });
    return [];
  }
}
