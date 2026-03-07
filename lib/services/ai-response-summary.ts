// ---------------------------------------------------------------------------
// lib/services/ai-response-summary.ts — S30 (§233)
//
// Pure functions for AI response summaries + one I/O fetcher.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AIResponseSnippet {
  snippet: string;
  engine: string;
  timestamp: string;
}

/**
 * Fetch the most recent AI response snippet from sov_evaluations.
 * Returns null if no evaluations exist.
 */
export async function getLatestAIResponse(
  supabase: SupabaseClient,
  orgId: string,
): Promise<AIResponseSnippet | null> {
  const { data } = await supabase
    .from('sov_evaluations')
    .select('raw_response, model_provider, created_at')
    .eq('org_id', orgId)
    .not('raw_response', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || !data.raw_response) return null;

  return {
    snippet: formatResponseSnippet(data.raw_response as string, 150),
    engine: data.model_provider as string,
    timestamp: data.created_at as string,
  };
}

/**
 * Returns true if the timestamp is older than thresholdDays.
 */
export function isResponseStale(
  timestamp: string | null | undefined,
  thresholdDays = 7,
): boolean {
  if (!timestamp) return true;
  const age = Date.now() - new Date(timestamp).getTime();
  return age > thresholdDays * 24 * 60 * 60 * 1000;
}

/**
 * Truncate a raw AI response at a sentence boundary (or word boundary fallback).
 * Returns empty string for null/empty input.
 */
export function formatResponseSnippet(
  rawResponse: string | null | undefined,
  maxLength = 150,
): string {
  if (!rawResponse) return '';
  const text = rawResponse.trim();
  if (text.length <= maxLength) return text;

  // Try to truncate at a sentence boundary
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  const sentenceEnd = Math.max(lastPeriod, lastExclaim, lastQuestion);

  if (sentenceEnd > maxLength * 0.4) {
    return text.slice(0, sentenceEnd + 1);
  }

  // Fallback: truncate at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.4) {
    return text.slice(0, lastSpace) + '…';
  }

  return truncated + '…';
}
