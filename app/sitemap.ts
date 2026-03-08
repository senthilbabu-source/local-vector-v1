// ---------------------------------------------------------------------------
// app/sitemap.ts — XML Sitemap (P7-FIX-32, Sprint B, Sprint C)
//
// Lists all public marketing pages for search engine crawlers.
// ---------------------------------------------------------------------------

import type { MetadataRoute } from 'next';
import { getAllSlugs } from '@/lib/blog/mdx';

// Top 10 metros — must match TRACKED_METROS in /for/[city]/page.tsx
const CITY_SLUGS = [
  'atlanta', 'dallas', 'houston', 'chicago', 'new-york',
  'los-angeles', 'miami', 'phoenix', 'denver', 'seattle',
];

// Comparison page slugs — must match COMPETITORS in /compare/[slug]/page.tsx
const COMPARE_SLUGS = [
  'localvector-vs-yext', 'localvector-vs-brightlocal',
  'localvector-vs-synup', 'localvector-vs-whitespark',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://localvector.ai';

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/scan`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/pricing`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/how-it-works`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/for`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/for/agencies`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/blog`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/glossary`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/case-studies`, changeFrequency: 'monthly', priority: 0.6 },
    // What-is pages
    { url: `${baseUrl}/what-is/aeo`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/what-is/geo`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/what-is/ai-hallucination`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/what-is/share-of-voice-ai`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/what-is/agent-seo`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/what-is/ai-overview`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/what-is/siri-readiness`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/what-is/apple-business-connect`, changeFrequency: 'monthly', priority: 0.7 },
    // Legal
    { url: `${baseUrl}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // Comparison pages (Sprint C)
  const comparePages: MetadataRoute.Sitemap = COMPARE_SLUGS.map((slug) => ({
    url: `${baseUrl}/compare/${slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // City pages (Sprint C)
  const cityPages: MetadataRoute.Sitemap = CITY_SLUGS.map((slug) => ({
    url: `${baseUrl}/for/${slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Dynamic blog post pages
  const blogSlugs = getAllSlugs();
  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...comparePages, ...cityPages, ...blogPages];
}
