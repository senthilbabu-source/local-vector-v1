// ---------------------------------------------------------------------------
// /blog/[slug] — Individual Blog Post (Sprint B)
//
// Renders MDX content via next-mdx-remote. Server Component.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import { getPostBySlug, getAllSlugs } from '@/lib/blog/mdx';

// ---------------------------------------------------------------------------
// Static generation
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Dynamic metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: 'Post Not Found — LocalVector.ai' };
  }

  return {
    title: `${post.title} | LocalVector.ai Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      siteName: 'LocalVector.ai',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'LocalVector.ai' },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <MarketingNav />

      <article
        style={{
          background: 'var(--m-bg-primary)',
          padding: '80px 24px 64px',
        }}
      >
        <div style={{ maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            {post.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: 'var(--m-green-light)',
                      color: 'var(--m-green-dark)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <h1
              style={{
                fontSize: 'clamp(28px, 5vw, 42px)',
                fontWeight: 800,
                color: 'var(--m-text-primary)',
                lineHeight: 1.15,
                marginBottom: 16,
              }}
            >
              {post.title}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: 'var(--m-text-muted)',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
            >
              {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} &middot; {post.readingTime} &middot; {post.author}
            </p>
          </div>

          {/* MDX content */}
          <div className="lv-blog-prose">
            <MDXRemote source={post.content} />
          </div>

          {/* Back + CTA */}
          <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid var(--m-border-base)' }}>
            <a
              href="/blog"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--m-green)',
                textDecoration: 'none',
              }}
            >
              &larr; Back to all posts
            </a>
            <div
              style={{
                marginTop: 32,
                padding: 32,
                borderRadius: 12,
                background: 'var(--m-green-light)',
                border: '1px solid var(--m-border-green)',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--m-text-primary)', marginBottom: 8 }}>
                Is AI telling the truth about your business?
              </p>
              <p style={{ fontSize: 15, color: 'var(--m-text-secondary)', marginBottom: 20 }}>
                Find out in 8 seconds with a free AI audit.
              </p>
              <a href="/scan" className="m-btn-primary" style={{ textDecoration: 'none' }}>
                Start Free AI Audit &rarr;
              </a>
            </div>
          </div>
        </div>
      </article>

      <MarketingFooter />
    </main>
  );
}
