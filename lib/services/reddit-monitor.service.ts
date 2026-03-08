// ---------------------------------------------------------------------------
// lib/services/reddit-monitor.service.ts — Reddit Brand Mention Monitor (Sprint 4)
//
// Uses Reddit's OAuth2 client credentials flow (no user login required).
// Searches for business name mentions in posts and comments.
// Pure service — caller provides Supabase client.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const REDDIT_USER_AGENT = 'LocalVector-Monitor/1.0 (by /u/localvector_bot)';

export interface RedditPost {
  reddit_post_id: string;
  post_type: 'post' | 'comment';
  subreddit: string;
  title: string | null;
  body: string;
  author: string;
  url: string;
  score: number;
  post_created_at: Date | null;
}

const NEGATIVE_WORDS = [
  'horrible', 'worst', 'terrible', 'awful', 'disgusting', 'rude', 'never again',
  'food poisoning', 'cockroach', 'rat', 'dirty', 'scam',
];

const POSITIVE_WORDS = [
  'amazing', 'best', 'love', 'excellent', 'fantastic',
  'recommend', 'delicious', 'wonderful', 'great',
];

/**
 * Classifies sentiment based on simple keyword matching.
 */
export function classifySentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase();
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) return 'negative';
  }
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) return 'positive';
  }
  return 'neutral';
}

/**
 * Gets a Reddit OAuth2 access token using client credentials flow.
 */
export async function getRedditAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET not configured');
  }

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'User-Agent': REDDIT_USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Reddit OAuth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Searches Reddit for posts mentioning the business name.
 */
export async function searchRedditMentions(
  accessToken: string,
  businessName: string,
): Promise<RedditPost[]> {
  const results: RedditPost[] = [];
  const encodedName = encodeURIComponent(`"${businessName}"`);

  // Search posts
  const postsResponse = await fetch(
    `https://oauth.reddit.com/search.json?q=${encodedName}&type=link&sort=new&limit=25&t=week`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    },
  );

  if (postsResponse.ok) {
    const postsData = await postsResponse.json();
    for (const child of postsData?.data?.children ?? []) {
      const post = child.data;
      results.push({
        reddit_post_id: post.name ?? `t3_${post.id}`,
        post_type: 'post',
        subreddit: post.subreddit ?? '',
        title: post.title ?? null,
        body: post.selftext ?? '',
        author: post.author ?? '[deleted]',
        url: `https://www.reddit.com${post.permalink ?? ''}`,
        score: post.score ?? 0,
        post_created_at: post.created_utc ? new Date(post.created_utc * 1000) : null,
      });
    }
  }

  // Search comments
  const commentsResponse = await fetch(
    `https://oauth.reddit.com/search.json?q=${encodedName}&type=comment&sort=new&limit=25&t=week`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    },
  );

  if (commentsResponse.ok) {
    const commentsData = await commentsResponse.json();
    for (const child of commentsData?.data?.children ?? []) {
      const comment = child.data;
      results.push({
        reddit_post_id: comment.name ?? `t1_${comment.id}`,
        post_type: 'comment',
        subreddit: comment.subreddit ?? '',
        title: null,
        body: comment.body ?? '',
        author: comment.author ?? '[deleted]',
        url: `https://www.reddit.com${comment.permalink ?? ''}`,
        score: comment.score ?? 0,
        post_created_at: comment.created_utc ? new Date(comment.created_utc * 1000) : null,
      });
    }
  }

  return results;
}

/**
 * Monitors Reddit for brand mentions and upserts new ones.
 * Never throws — returns partial results with errors array.
 */
export async function monitorRedditMentions(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
  businessName: string,
): Promise<{ new_mentions: number; errors: string[] }> {
  const result = { new_mentions: 0, errors: [] as string[] };

  try {
    const clientId = process.env.REDDIT_CLIENT_ID;
    if (!clientId) return result;

    const accessToken = await getRedditAccessToken();
    const mentions = await searchRedditMentions(accessToken, businessName);

    for (const mention of mentions) {
      try {
        const sentiment = classifySentiment(mention.body);

        const { error } = await (supabase.from as unknown as (table: string) => {
          upsert: (row: Record<string, unknown>, opts: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: { message: string } | null }>;
        })('reddit_brand_mentions').upsert(
          {
            org_id: orgId,
            location_id: locationId,
            reddit_post_id: mention.reddit_post_id,
            post_type: mention.post_type,
            subreddit: mention.subreddit,
            title: mention.title,
            body: mention.body,
            author: mention.author,
            url: mention.url,
            score: mention.score,
            sentiment,
            post_created_at: mention.post_created_at?.toISOString() ?? null,
          },
          { onConflict: 'org_id,reddit_post_id', ignoreDuplicates: true },
        );

        if (error) {
          result.errors.push(`Upsert failed for ${mention.reddit_post_id}: ${error.message}`);
        } else {
          result.new_mentions++;
        }
      } catch (mentionErr) {
        const msg = mentionErr instanceof Error ? mentionErr.message : String(mentionErr);
        result.errors.push(`Failed to process ${mention.reddit_post_id}: ${msg}`);
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'reddit-monitor', sprint: '4' },
    });
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
  }

  return result;
}
