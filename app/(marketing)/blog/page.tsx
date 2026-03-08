// ---------------------------------------------------------------------------
// /blog — Blog Index Page (Sprint B)
//
// Lists all blog posts sorted by date descending. Server Component.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';
import { getAllPosts } from '@/lib/blog/mdx';

export const metadata: Metadata = {
  title: 'Blog — AI Visibility Insights for Local Business | LocalVector.ai',
  description:
    'Practical guides, industry analysis, and strategies for improving your local business visibility in AI search engines like ChatGPT, Gemini, Perplexity, and Siri.',
  openGraph: {
    title: 'LocalVector Blog — AI Visibility for Local Business',
    description: 'Practical guides for improving AI search visibility.',
    siteName: 'LocalVector.ai',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LocalVector Blog',
    description: 'AI visibility insights for local businesses.',
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <main>
      <MarketingNav />
      <PageHero
        label="BLOG"
        title="AI Visibility Insights"
        subtitle="Practical guides and strategies for local businesses navigating AI-powered search."
      />

      <section
        style={{
          background: 'var(--m-bg-primary)',
          padding: '64px 24px 80px',
        }}
      >
        <div
          style={{
            maxWidth: 800,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {posts.length === 0 ? (
            <p style={{ fontSize: 16, color: 'var(--m-text-secondary)', textAlign: 'center' }}>
              Blog posts coming soon.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {posts.map((post) => (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="m-reveal"
                  style={{
                    display: 'block',
                    background: 'var(--m-bg-card, #FFFFFF)',
                    border: '1px solid var(--m-border-base)',
                    borderRadius: 12,
                    padding: '28px 32px',
                    textDecoration: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                >
                  {/* Tags */}
                  {post.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
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

                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--m-text-primary)',
                      lineHeight: 1.3,
                      marginBottom: 8,
                    }}
                  >
                    {post.title}
                  </h2>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: 'var(--m-text-secondary)',
                      marginBottom: 12,
                    }}
                  >
                    {post.description}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'var(--m-text-muted)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      margin: 0,
                    }}
                  >
                    {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &middot; {post.readingTime} &middot; {post.author}
                  </p>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section
        className="m-section"
        style={{
          background: 'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
        }}
      >
        <div className="m-reveal">
          <h2 className="m-display" style={{ maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', marginBottom: 20 }}>
            See AI visibility in action
          </h2>
          <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
            Run a free AI audit and see exactly what ChatGPT, Gemini, and Perplexity say about your business.
          </p>
          <a href="/scan" className="m-btn-primary" style={{ textDecoration: 'none' }}>
            Start Free AI Audit &rarr;
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
