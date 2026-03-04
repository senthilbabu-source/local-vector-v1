// ---------------------------------------------------------------------------
// app/sitemap.ts — XML Sitemap (P7-FIX-32)
//
// Lists all public marketing pages for search engine crawlers.
// ---------------------------------------------------------------------------

import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://localvector.ai';

  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
