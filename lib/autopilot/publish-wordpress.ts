// ---------------------------------------------------------------------------
// lib/autopilot/publish-wordpress.ts — WordPress REST API Publisher
//
// Publishes draft content as a WordPress page via REST API.
// Creates as WordPress 'draft' status (second approval in WP admin).
//
// SECURITY: Credentials from location_integrations, RLS-scoped.
// Never sent to client; used server-side only.
//
// Spec: docs/19-AUTOPILOT-ENGINE.md §5.2
// ---------------------------------------------------------------------------

import type { ContentDraftRow, PublishResult } from '@/lib/types/autopilot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
}

// ---------------------------------------------------------------------------
// WordPress Block Converter
// ---------------------------------------------------------------------------

/**
 * Converts plain text content to WordPress block editor format.
 * Wraps each paragraph in a wp:paragraph block comment.
 */
export function contentToWPBlocks(content: string): string {
  return content
    .split(/\n\n+/)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      return `<!-- wp:paragraph -->\n<p>${trimmed}</p>\n<!-- /wp:paragraph -->`;
    })
    .filter(Boolean)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Publishes draft as a WordPress draft page via REST API.
 * Creates with 'draft' status for second approval in WP admin.
 */
export async function publishToWordPress(
  draft: ContentDraftRow,
  config: WordPressConfig,
): Promise<PublishResult> {
  if (!config.siteUrl || !config.username || !config.appPassword) {
    throw new Error('WordPress credentials not configured. Check your Application Password in Settings → Integrations.');
  }

  // Normalize site URL — handles trailing slashes safely
  const apiUrl = new URL('/wp-json/wp/v2/pages', config.siteUrl).href;

  // Convert content to WP blocks
  const wpContent = contentToWPBlocks(draft.draft_content);

  // Basic auth header (Application Password)
  // Trim external whitespace from password (users may copy-paste with extra spaces)
  // but preserve internal spaces — WP Application Passwords are space-separated groups
  const authHeader = Buffer.from(
    `${config.username}:${config.appPassword.trim()}`,
  ).toString('base64');

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: draft.draft_title,
        content: wpContent,
        status: 'draft', // Second approval layer in WP admin
      }),
    });
  } catch {
    throw new Error('WordPress site unreachable. Check the site URL in Settings → Integrations.');
  }

  if (response.status === 401) {
    throw new Error(
      'WordPress authentication failed. Check your Application Password in Settings → Integrations.',
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`WordPress publish failed (${response.status}): ${errorText}`);
  }

  const wpPost = await response.json();
  return {
    publishedUrl: wpPost.link ?? null,
    status: 'published',
  };
}
