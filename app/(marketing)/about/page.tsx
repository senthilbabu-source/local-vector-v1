// ---------------------------------------------------------------------------
// /about — About Page (LocalVector.ai Marketing)
//
// Origin story, mission, founder bio, trust signals.
// Server Component — no 'use client'. Inline styles only.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';
import { SectionLabel } from '../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'About LocalVector.ai | Built by a Local Business Owner, for Local Business Owners',
  description:
    'LocalVector.ai was built by Aruna, the owner of Charcoal N Chill in Alpharetta, GA, ' +
    'after discovering that ChatGPT was sending customers away from a business that was actually open.',
};

// ---------------------------------------------------------------------------
// Shared layout helpers
// ---------------------------------------------------------------------------

const sectionPadding: React.CSSProperties = {
  padding: '80px 24px',
};

const innerMax: React.CSSProperties = {
  maxWidth: 1120,
  marginLeft: 'auto',
  marginRight: 'auto',
};

const narrowMax: React.CSSProperties = {
  maxWidth: 720,
  marginLeft: 'auto',
  marginRight: 'auto',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboutPage() {
  return (
    <div className="lv-marketing">
      <MarketingNav />

      {/* ── Hero ── */}
      <PageHero
        label="About"
        title="We didn't build LocalVector because we thought it would be a good idea. We built it because we had to."
      />

      {/* ── Origin Story ── */}
      <section
        className="m-reveal"
        style={{
          ...sectionPadding,
          background: 'var(--m-bg-primary)',
        }}
      >
        <div style={{ ...innerMax, ...narrowMax }}>
          <SectionLabel>Origin Story</SectionLabel>
          <h2
            className="m-display"
            style={{
              fontSize: 'clamp(24px, 3vw, 36px)',
              fontWeight: 800,
              color: 'var(--m-text-primary)',
              lineHeight: 1.15,
              marginBottom: 32,
              letterSpacing: '-0.02em',
            }}
          >
            It started with a Monday night at the bar
          </h2>
          <div
            style={{
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--m-text-secondary)',
            }}
          >
            <p style={{ marginBottom: 20 }}>
              In 2025, Aruna &mdash; the founder &mdash; was sitting at the bar of Charcoal N Chill,
              her hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia. Monday
              nights had been slow. Reviews were strong. The food was good. Something else was wrong.
            </p>
            <p style={{ marginBottom: 20 }}>
              On a whim, she asked ChatGPT: &ldquo;Is Charcoal N Chill open on Mondays?&rdquo;
            </p>
            <p
              style={{
                marginBottom: 20,
                fontWeight: 600,
                color: 'var(--m-text-primary)',
              }}
            >
              It said: &ldquo;Charcoal N Chill appears to be closed on Mondays.&rdquo;
            </p>
            <p style={{ marginBottom: 20 }}>
              She was sitting in the open restaurant. The lights were on. Customers were ordering.
              And ChatGPT was telling people not to come.
            </p>
            <p style={{ marginBottom: 20 }}>
              The estimated lost revenue was uncomfortable. Aruna is a data person &mdash; 18 years
              as Lead SAS Programmer and Data Manager for the CDC. She didn&apos;t write an angry
              tweet. She built a tool to detect it, track it, and fix it.
            </p>
            <p style={{ marginBottom: 0 }}>
              That internal tool became LocalVector.ai.
            </p>
          </div>
        </div>
      </section>

      {/* ── What Makes This Different ── */}
      <section
        className="m-reveal"
        style={{
          ...sectionPadding,
          background: 'var(--m-bg-secondary)',
        }}
      >
        <div style={{ ...innerMax, ...narrowMax }}>
          <SectionLabel>What Makes This Different</SectionLabel>

          {/* Pull quote */}
          <blockquote
            className="m-reveal-left"
            style={{
              borderLeft: '4px solid var(--m-green)',
              paddingLeft: 24,
              marginLeft: 0,
              marginRight: 0,
              marginTop: 0,
              marginBottom: 40,
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2.5vw, 24px)',
              lineHeight: 1.55,
              color: 'var(--m-text-primary)',
              fontWeight: 500,
            }}
          >
            &ldquo;Most SaaS products are built by engineers who interview business owners.
            LocalVector was built by a business owner who happens to be an engineer.&rdquo;
          </blockquote>

          <ul
            className="m-reveal-stagger"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {[
              {
                title: 'Alerts designed for someone with 47 other things to do',
                desc: 'No dashboards you have to remember to check. We tell you what changed, what it means, and what to do — in plain language.',
              },
              {
                title: 'Fixes designed to take under 5 minutes',
                desc: 'Every issue comes with a specific action. Not a report. Not a recommendation deck. A thing you can do right now.',
              },
              {
                title: 'ROI framing for someone counting customers, not clicks',
                desc: 'We translate AI errors into estimated lost revenue. Because "your NAP data is inconsistent" means nothing. "$1,200/month in lost customers" means everything.',
              },
            ].map((item) => (
              <li
                key={item.title}
                className="m-reveal"
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--m-green-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--m-green)',
                    fontWeight: 700,
                    fontSize: 16,
                    marginTop: 2,
                  }}
                >
                  {'\u2713'}
                </span>
                <div>
                  <p
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: 'var(--m-text-primary)',
                      marginBottom: 4,
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: 'var(--m-text-secondary)',
                      margin: 0,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Mission ── */}
      <section
        className="m-reveal"
        style={{
          ...sectionPadding,
          background: 'var(--m-bg-primary)',
        }}
      >
        <div style={{ ...innerMax, ...narrowMax }}>
          <SectionLabel>Our Mission</SectionLabel>
          <h2
            className="m-display m-text-shimmer"
            style={{
              fontSize: 'clamp(24px, 3vw, 36px)',
              fontWeight: 800,
              color: 'var(--m-text-primary)',
              lineHeight: 1.15,
              marginBottom: 24,
              letterSpacing: '-0.02em',
            }}
          >
            Making the AI search era fair for independent local businesses
          </h2>
          <div
            style={{
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--m-text-secondary)',
            }}
          >
            <p style={{ marginBottom: 20 }}>
              The chains will figure it out. They have teams. They have budgets. They have agencies
              on retainer who will read the whitepapers and adjust the strategy.
            </p>
            <p style={{ marginBottom: 0 }}>
              The independent owner running two locations &mdash; the one who is the host, the
              bookkeeper, the HR department, and the marketing team &mdash; needs the same
              protection. At a price that makes sense. That&apos;s what we build.
            </p>
          </div>
        </div>
      </section>

      {/* ── Charcoal N Chill ── */}
      <section
        className="m-reveal"
        style={{
          ...sectionPadding,
          background: 'var(--m-bg-secondary)',
        }}
      >
        <div style={{ ...innerMax, ...narrowMax }}>
          <SectionLabel>Where It All Started</SectionLabel>
          <h2
            className="m-display"
            style={{
              fontSize: 'clamp(24px, 3vw, 36px)',
              fontWeight: 800,
              color: 'var(--m-text-primary)',
              lineHeight: 1.15,
              marginBottom: 24,
              letterSpacing: '-0.02em',
            }}
          >
            Charcoal N Chill
          </h2>
          <div
            style={{
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--m-text-secondary)',
            }}
          >
            <p style={{ marginBottom: 20 }}>
              11950 Jones Bridge Rd, Alpharetta, GA 30005. 50+ hookah flavors, Indo-American fusion
              cuisine, live entertainment, and a full bar. Open Monday through Sunday.
            </p>
            <p style={{ marginBottom: 20 }}>
              Charcoal N Chill was LocalVector&apos;s first customer. It&apos;s still the primary
              test environment. Every feature gets stress-tested on a real business with real
              revenue at stake before it ships to anyone else.
            </p>
            <p style={{ marginBottom: 0, fontWeight: 500, color: 'var(--m-text-primary)' }}>
              If you&apos;re ever in Alpharetta, come by. Sit at the bar. Ask the staff about the
              time ChatGPT tried to close them down on Mondays. They&apos;ll have a story for you.
            </p>
          </div>
        </div>
      </section>

      {/* ── The Founder ── */}
      <section
        className="m-reveal-scale"
        style={{
          ...sectionPadding,
          background: 'var(--m-bg-primary)',
        }}
      >
        <div style={{ ...innerMax, ...narrowMax }}>
          <SectionLabel>The Founder</SectionLabel>
          <div
            style={{
              background: 'var(--m-bg-secondary)',
              border: '1px solid var(--m-border-base)',
              borderRadius: 16,
              padding: 'clamp(24px, 4vw, 40px)',
            }}
          >
            <h2
              className="m-display"
              style={{
                fontSize: 'clamp(22px, 3vw, 32px)',
                fontWeight: 800,
                color: 'var(--m-text-primary)',
                lineHeight: 1.2,
                marginBottom: 24,
                letterSpacing: '-0.02em',
              }}
            >
              Aruna Surendera Babu
            </h2>
            <div
              style={{
                fontSize: 16,
                lineHeight: 1.75,
                color: 'var(--m-text-secondary)',
              }}
            >
              <p style={{ marginBottom: 16 }}>
                18+ years in public health data analytics. Lead SAS Programmer and Data Manager for
                CDC surveillance programs. Published researcher in{' '}
                <em>AIDS &amp; Behavior</em> and the{' '}
                <em>American Journal of Public Health</em>.
              </p>
              <p style={{ marginBottom: 16 }}>
                Business owner. Staffing firm founder. LocalVector is the fourth product. The
                first one that started with a ChatGPT hallucination.
              </p>
            </div>
            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: '1px solid var(--m-border-base)',
              }}
            >
              <a
                href="mailto:hello@localvector.ai"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--m-green)',
                  textDecoration: 'none',
                }}
              >
                hello@localvector.ai
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Signals ── */}
      <section
        className="m-reveal-scale"
        style={{
          ...sectionPadding,
          background: 'var(--m-bg-secondary)',
        }}
      >
        <div style={{ ...innerMax, ...narrowMax }}>
          <SectionLabel>Infrastructure &amp; Trust</SectionLabel>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(0,168,107,0.04) 0%, rgba(0,168,107,0.08) 100%)',
              border: '1px solid var(--m-border-green, rgba(0,168,107,0.2))',
              borderRadius: 16,
              padding: 'clamp(24px, 4vw, 40px)',
            }}
          >
            <h3
              className="m-display"
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--m-text-primary)',
                marginBottom: 24,
              }}
            >
              Your data. Our responsibility.
            </h3>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {[
                'Built on Vercel + Supabase infrastructure',
                'Data encrypted at rest and in transit',
                'SOC-2 aligned security practices',
                'AI responses stored with full audit trail',
                'Never sells or shares customer business data',
              ].map((item) => (
                <li
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: 'var(--m-text-secondary)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      color: 'var(--m-green)',
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {'\u2713'}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        className="m-reveal"
        style={{
          padding: '80px 24px',
          background: 'var(--m-bg-primary)',
          textAlign: 'center',
        }}
      >
        <div style={innerMax}>
          <h2
            className="m-display m-text-shimmer"
            style={{
              fontSize: 'clamp(24px, 3.5vw, 40px)',
              fontWeight: 800,
              color: 'var(--m-text-primary)',
              lineHeight: 1.15,
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            See what AI is saying about your business
          </h2>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: 'var(--m-text-secondary)',
              marginBottom: 32,
              maxWidth: 540,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Run a free audit. No account required. Results in under 60 seconds.
          </p>
          <a
            href="/scan"
            className="m-btn-primary"
            style={{
              fontSize: 16,
              padding: '14px 32px',
              display: 'inline-flex',
            }}
          >
            Run Free AI Audit &rarr;
          </a>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
