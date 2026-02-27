// ---------------------------------------------------------------------------
// lib/autopilot/publish-gbp.ts — GBP Post Publisher
//
// Publishes draft content as a Google Business Profile Local Post.
// Handles OAuth token refresh and 1500-char GBP content limit.
//
// SECURITY: Token fetched via service-role client (no RLS).
// Never expose tokens to the client.
//
// Spec: docs/19-AUTOPILOT-ENGINE.md §5.3
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ContentDraftRow, PublishResult } from '@/lib/types/autopilot';
import { refreshGBPAccessToken } from '@/lib/services/gbp-token-refresh';

/** GBP post body maximum length. */
export const GBP_MAX_CHARS = 1500;

// ---------------------------------------------------------------------------
// Utility: Truncate at Sentence Boundary
// ---------------------------------------------------------------------------

/**
 * Truncates text at the last sentence boundary before maxChars.
 * If no sentence boundary found within 80% of limit, truncates at word boundary with ellipsis.
 */
export function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const cutoff = text.slice(0, maxChars);

  // Look for last sentence-ending punctuation
  const lastSentenceEnd = Math.max(
    cutoff.lastIndexOf('.'),
    cutoff.lastIndexOf('!'),
    cutoff.lastIndexOf('?'),
  );

  // Accept if it's within 80% of the limit
  if (lastSentenceEnd >= maxChars * 0.8) {
    return cutoff.slice(0, lastSentenceEnd + 1);
  }

  // Fallback: truncate at word boundary with ellipsis
  const lastSpace = cutoff.lastIndexOf(' ');
  if (lastSpace > 0) {
    return cutoff.slice(0, lastSpace) + '...';
  }

  return cutoff.slice(0, maxChars - 3) + '...';
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Publishes draft as a GBP Local Post.
 * Truncates content to GBP_MAX_CHARS at sentence boundary.
 * Handles token refresh on expiry.
 */
export async function publishToGBP(
  draft: ContentDraftRow,
  orgId: string,
  supabase: SupabaseClient<Database>,
): Promise<PublishResult> {
  // Fetch OAuth token (service-role, no RLS on google_oauth_tokens)
  const { data: tokenRow, error: tokenError } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at, gbp_account_name')
    .eq('org_id', orgId)
    .single();

  if (tokenError || !tokenRow) {
    throw new Error('GBP not connected. Go to Settings → Integrations to connect Google Business Profile.');
  }

  // Check if token needs refresh
  let accessToken = tokenRow.access_token;
  const expiresAt = new Date(tokenRow.expires_at);
  if (expiresAt <= new Date()) {
    const refreshResult = await refreshGBPAccessToken(orgId, tokenRow.refresh_token, supabase);
    if (!refreshResult.success) throw new Error(refreshResult.error ?? 'Token refresh failed');
    accessToken = refreshResult.newAccessToken!;
  }

  // Get location name for the GBP API URL
  const locationName = draft.location_id
    ? (await supabase
        .from('locations')
        .select('google_location_name')
        .eq('id', draft.location_id)
        .single()
      ).data?.google_location_name
    : null;

  if (!locationName) {
    throw new Error('Location not linked to a Google Business Profile. Set the Google location name in location settings.');
  }

  // Truncate content for GBP
  const truncatedContent = truncateAtSentence(draft.draft_content, GBP_MAX_CHARS);

  // Post to GBP API
  const postBody = {
    languageCode: 'en',
    summary: truncatedContent,
    topicType: 'STANDARD',
  };

  const gbpResponse = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postBody),
    },
  );

  // Handle token expiry (401) with one retry
  if (gbpResponse.status === 401) {
    const retryRefresh = await refreshGBPAccessToken(orgId, tokenRow.refresh_token, supabase);
    if (!retryRefresh.success) throw new Error(retryRefresh.error ?? 'Token refresh failed');
    const newToken = retryRefresh.newAccessToken!;
    const retryResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody),
      },
    );

    if (!retryResponse.ok) {
      throw new Error(`GBP post failed after token refresh: ${retryResponse.status}`);
    }

    const retryData = await retryResponse.json();
    return {
      publishedUrl: retryData.searchUrl ?? null,
      status: 'published',
    };
  }

  if (!gbpResponse.ok) {
    throw new Error(`GBP post failed: ${gbpResponse.status}`);
  }

  const gbpData = await gbpResponse.json();
  return {
    publishedUrl: gbpData.searchUrl ?? null,
    status: 'published',
  };
}
