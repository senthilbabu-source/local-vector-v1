// ---------------------------------------------------------------------------
// lib/services/community-monitor.service.ts — Community Platform Monitor (Sprint 6)
//
// Detects brand mentions on Nextdoor and Quora using Perplexity sonar-pro
// web search. No official API for either platform — LLM search grounding only.
//
// One Perplexity call per platform per org per week (recency-gated).
// Pure async service — caller provides Supabase client.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { generateText } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getModel, hasApiKey } from '@/lib/ai/providers';

// ── Sentiment word lists (same as Reddit monitor, Sprint 4) ─────────────────

const NEGATIVE_WORDS = [
  'horrible', 'worst', 'terrible', 'awful', 'disgusting', 'rude', 'never again',
  'food poisoning', 'cockroach', 'rat', 'dirty', 'scam',
];

const POSITIVE_WORDS = [
  'amazing', 'best', 'love', 'excellent', 'fantastic',
  'recommend', 'delicious', 'wonderful', 'great',
];

// ── Prompt builders ─────────────────────────────────────────────────────────

export function buildNextdoorPrompt(businessName: string, city: string, state: string): string {
  return `Search Nextdoor for any posts, recommendations, or discussions mentioning "${businessName}" in ${city}, ${state}.

List each mention you find with:
1. The post content or a summary
2. The poster name (if visible)
3. Approximate date
4. Direct URL (if available)

If no mentions are found, respond with: NO_MENTIONS_FOUND

Format each result as:
MENTION: [content]
AUTHOR: [name or "Anonymous"]
DATE: [date or "Unknown"]
URL: [url or "None"]`;
}

export function buildQuoraPrompt(businessName: string, city: string, state: string): string {
  return `Search Quora for any questions, answers, or posts mentioning "${businessName}" in ${city}, ${state} or related to its business category.

List each mention with:
1. The question or answer content (summary)
2. The author name
3. Approximate date
4. Direct URL

If no mentions are found, respond with: NO_MENTIONS_FOUND

Format each result as:
MENTION: [content]
AUTHOR: [name or "Anonymous"]
DATE: [date or "Unknown"]
URL: [url or "None"]`;
}

// ── Response parser ─────────────────────────────────────────────────────────

export interface ParsedMention {
  content: string;
  author: string;
  date: string;
  url: string | null;
}

/**
 * Parses structured MENTION:/AUTHOR:/DATE:/URL: blocks from Perplexity response.
 * Returns [] if NO_MENTIONS_FOUND or empty input.
 */
export function parseMentionsFromResponse(text: string): ParsedMention[] {
  if (!text || text.includes('NO_MENTIONS_FOUND')) return [];

  const mentions: ParsedMention[] = [];
  const blocks = text.split(/(?=MENTION:)/i).filter((b) => b.trim());

  for (const block of blocks) {
    const contentMatch = block.match(/MENTION:\s*(.+?)(?=\nAUTHOR:|$)/i);
    const authorMatch = block.match(/AUTHOR:\s*(.+?)(?=\nDATE:|$)/i);
    const dateMatch = block.match(/DATE:\s*(.+?)(?=\nURL:|$)/i);
    const urlMatch = block.match(/URL:\s*(.+?)$/im);

    if (contentMatch) {
      const rawUrl = urlMatch?.[1]?.trim() ?? '';
      mentions.push({
        content: contentMatch[1].trim(),
        author: authorMatch?.[1]?.trim() ?? 'Anonymous',
        date: dateMatch?.[1]?.trim() ?? 'Unknown',
        url: rawUrl && rawUrl.toLowerCase() !== 'none' && rawUrl.startsWith('http') ? rawUrl : null,
      });
    }
  }

  return mentions;
}

// ── Sentiment classifier ────────────────────────────────────────────────────

/**
 * Classifies mention sentiment based on keyword matching.
 * Same word lists as Reddit monitor (Sprint 4).
 */
export function classifyMentionSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) return 'negative';
  }
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) return 'positive';
  }
  return 'neutral';
}

// ── Mention key generator ───────────────────────────────────────────────────

/**
 * Generates a dedup key: SHA-256 hex of platform + first 200 chars of content.
 */
export async function generateMentionKey(platform: string, content: string): Promise<string> {
  const input = `${platform}${content.slice(0, 200)}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Main orchestrator ───────────────────────────────────────────────────────

export async function monitorCommunityPlatforms(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
  businessName: string,
  city: string,
  state: string,
): Promise<{ nextdoor_mentions: number; quora_mentions: number; errors: string[] }> {
  const result = { nextdoor_mentions: 0, quora_mentions: 0, errors: [] as string[] };

  // Skip if Perplexity not configured
  if (!hasApiKey('perplexity')) return result;

  const platforms = ['nextdoor', 'quora'] as const;

  for (const platform of platforms) {
    try {
      // Recency gate: skip if already scanned in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await (supabase.from as unknown as (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => {
              gte: (col: string, val: string) => {
                limit: (n: number) => Promise<{ data: unknown[] | null }>;
              };
            };
          };
        };
      })('community_mentions')
        .select('id')
        .eq('org_id', orgId)
        .eq('platform', platform)
        .gte('detected_at', sevenDaysAgo)
        .limit(1);

      if (recent && recent.length > 0) continue; // Already scanned this week

      // Build prompt
      const prompt = platform === 'nextdoor'
        ? buildNextdoorPrompt(businessName, city, state)
        : buildQuoraPrompt(businessName, city, state);

      // Call Perplexity
      const { text } = await generateText({
        model: getModel('community-monitor'),
        system: 'You are a web search assistant. Search for mentions and return results in the exact format requested.',
        prompt,
      });

      // Parse response
      const mentions = parseMentionsFromResponse(text);

      // Upsert each mention
      for (const mention of mentions) {
        try {
          const mentionKey = await generateMentionKey(platform, mention.content);
          const sentiment = classifyMentionSentiment(mention.content);

          const { error } = await (supabase.from as unknown as (table: string) => {
            upsert: (row: Record<string, unknown>, opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: { message: string } | null }>;
          })('community_mentions').upsert(
            {
              org_id: orgId,
              location_id: locationId,
              platform,
              mention_key: mentionKey,
              content: mention.content,
              author: mention.author,
              url: mention.url,
              sentiment,
              approximate_date: mention.date,
            },
            { onConflict: 'org_id,mention_key', ignoreDuplicates: true },
          );

          if (error) {
            result.errors.push(`Upsert failed for ${platform}: ${error.message}`);
          } else {
            if (platform === 'nextdoor') result.nextdoor_mentions++;
            else result.quora_mentions++;
          }
        } catch (mentionErr) {
          const msg = mentionErr instanceof Error ? mentionErr.message : String(mentionErr);
          result.errors.push(`Failed to process ${platform} mention: ${msg}`);
        }
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'community-monitor', platform, sprint: '6' },
      });
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${platform}: ${msg}`);
    }
  }

  return result;
}
