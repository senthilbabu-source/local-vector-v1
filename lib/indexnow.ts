// ---------------------------------------------------------------------------
// lib/indexnow.ts — IndexNow URL Submission Utility
//
// Sprint 106: Fire-and-forget URL submission to IndexNow for rapid
// re-indexing by Bing, Yandex, and other participating search engines.
//
// PURE UTILITY — never blocks the calling flow. Returns boolean success.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

/**
 * Submit URLs to IndexNow for rapid re-indexing.
 * Fire-and-forget — never blocks the calling flow.
 *
 * @param urls    - Array of full URLs to submit
 * @param host    - The host domain (e.g. 'schema.localvector.ai')
 * @returns true on success, false on failure (logged to Sentry)
 */
export async function pingIndexNow(
  urls: string[],
  host: string = 'schema.localvector.ai',
): Promise<boolean> {
  const key = process.env.INDEXNOW_API_KEY;
  if (!key) return false;
  if (urls.length === 0) return false;

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    // IndexNow returns 200 or 202 on success
    return response.status === 200 || response.status === 202;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'indexnow', sprint: '106' },
      extra: { urls, host },
    });
    return false;
  }
}
