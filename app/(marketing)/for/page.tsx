// ---------------------------------------------------------------------------
// /for — "Who It's For" Page (Website Content Strategy v2.0 — Phase 2)
//
// Light theme via (marketing) layout. 5 verticals + self-qualifier.
// Server Component — no 'use client'. Inline styles.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';
import { SectionLabel } from '../_components/MarketingShared';

export const metadata: Metadata = {
  title:
    'Who LocalVector.ai Is For | AI Visibility for Restaurants, Medical, Home Services & More',
  description:
    'LocalVector.ai serves restaurants, bars, hookah lounges, medical practices, home service providers, and the agencies that represent them. See if your business is a fit.',
};

// ---------------------------------------------------------------------------
// Vertical data
// ---------------------------------------------------------------------------

interface Vertical {
  id: string;
  label: string;
  title: string;
  borderColor: string;
  bgColor: string;
  intro: string;
  risks: string[];
  features: string[];
  whoSpecifically: string[];
  cta: string;
  ctaHref: string;
  callout?: { text: string; attribution?: string };
}

const VERTICALS: Vertical[] = [
  {
    id: 'restaurants',
    label: 'RESTAURANTS & BARS',
    title: 'The original use case. The highest risk.',
    borderColor: '#00A86B',
    bgColor: 'rgba(0, 168, 107, 0.04)',
    intro:
      'When someone asks ChatGPT "best hookah lounge near me" or "does Charcoal N Chill have outdoor seating?" \u2014 the answer better be right. It usually isn\u2019t.',
    risks: [
      'AI says you\u2019re closed on your busiest night \u2014 customers go elsewhere',
      'Your menu is outdated or hallucinated \u2014 customers arrive expecting dishes you don\u2019t serve',
      'AI recommends a competitor because their structured data is better, not their food',
      'Delivery platforms pull AI-generated descriptions that are flat-out wrong',
    ],
    features: [
      'Magic Menu \u2014 turns your PDF menu into AI-readable JSON-LD in seconds',
      'Reality Score \u2014 real-time accuracy tracking across ChatGPT, Perplexity, Gemini',
      'Hallucination Alerts \u2014 get notified when AI invents facts about your restaurant',
      'llms.txt + ai-config.json \u2014 tell AI models the truth, in their language',
    ],
    whoSpecifically: [
      'Independent restaurants',
      'Hookah lounges',
      'Cocktail bars & speakeasies',
      'Casual dining & fast-casual',
      'Brunch spots & caf\u00E9s',
      'Food trucks with a fixed location',
    ],
    cta: 'See what AI says about your restaurant',
    ctaHref: '/scan',
    callout: {
      text: 'Charcoal N Chill lost an estimated $1,600/mo because ChatGPT told customers they didn\u2019t have outdoor seating. They do. AI was wrong for 4 months before anyone noticed.',
      attribution: 'Real example \u2014 discovered during beta',
    },
  },
  {
    id: 'medical',
    label: 'MEDICAL & DENTAL PRACTICES',
    title: 'Wrong information here isn\u2019t just revenue \u2014 it\u2019s trust.',
    borderColor: '#1E3A5F',
    bgColor: 'rgba(30, 58, 95, 0.04)',
    intro:
      'When a patient asks AI "does Dr. Kim accept Blue Cross?" or "is this dentist open Saturday?" \u2014 a wrong answer doesn\u2019t just lose a patient. It erodes the trust that took years to build.',
    risks: [
      'AI says you don\u2019t accept a major insurance provider \u2014 new patients never call',
      'Office hours are wrong \u2014 patients show up to a locked door',
      'AI confuses your specialization with another practice \u2014 wrong referrals',
      'Your practice doesn\u2019t appear in "near me" AI results at all',
    ],
    features: [
      'Reality Score \u2014 monitors what AI says about your practice across all major models',
      'NAP Sync \u2014 ensures name, address, phone, and hours are consistent on the Big 6 listings',
      'AI Sentiment \u2014 tracks how AI frames your practice to potential patients',
      'Hallucination Alerts \u2014 instant notification when AI gets your details wrong',
    ],
    whoSpecifically: [
      'Private dental practices',
      'Medical clinics & urgent care',
      'Dermatology & cosmetic practices',
      'Chiropractic & physical therapy',
      'Veterinary clinics',
      'Optometry & vision centers',
    ],
    cta: 'Check your practice\u2019s AI accuracy',
    ctaHref: '/scan',
  },
  {
    id: 'home-services',
    label: 'HOME SERVICES',
    title: '"Near me" is the new Yellow Pages. AI is the new "near me."',
    borderColor: '#D97706',
    bgColor: 'rgba(217, 119, 6, 0.04)',
    intro:
      'Home service searches are almost always urgent and local. "Emergency plumber near me" has zero patience for wrong results. If AI sends that customer to your competitor, you don\u2019t get a second chance.',
    risks: [
      'AI says you don\u2019t serve a zip code you\u2019ve covered for 15 years',
      'Service scope is wrong \u2014 AI says you do HVAC but not ductwork (you do both)',
      'AI shows outdated rates or invented pricing \u2014 customers arrive with wrong expectations',
      'Licensing and certification details are hallucinated or missing entirely',
    ],
    features: [
      'Reality Score \u2014 catch errors before customers do',
      'Share of Voice \u2014 see where competitors outrank you in AI recommendations',
      'NAP Sync \u2014 keep service area and contact info consistent across the Big 6',
      'AI-Ready Structured Data \u2014 make sure AI knows exactly what you offer',
    ],
    whoSpecifically: [
      'Plumbers & HVAC technicians',
      'Electricians & general contractors',
      'Roofers & painters',
      'Landscapers & lawn care',
      'Cleaning services',
      'Pest control & restoration',
    ],
    cta: 'Scan your service business',
    ctaHref: '/scan',
  },
  {
    id: 'professional',
    label: 'PROFESSIONAL SERVICES',
    title: 'When AI gets your practice areas wrong, you attract the wrong clients.',
    borderColor: '#475569',
    bgColor: 'rgba(71, 85, 105, 0.04)',
    intro:
      'A law firm that does estate planning doesn\u2019t want AI sending them personal injury leads. An accountant who specializes in small business doesn\u2019t want AI saying they do corporate audits. Wrong positioning wastes everyone\u2019s time.',
    risks: [
      'AI misrepresents your practice areas \u2014 you get inquiries you can\u2019t serve',
      'Availability and consultation hours are wrong \u2014 prospects call at the wrong time',
      'AI confuses you with a similarly-named firm \u2014 reputation damage',
      'Firm size and capabilities are overstated or understated by AI',
    ],
    features: [
      'Reality Score \u2014 verify what AI says about your expertise',
      'Hallucination Detection \u2014 catch when AI invents credentials or practice areas',
      'AI Sentiment \u2014 understand how AI positions you vs. competitors',
      'Structured Data Generation \u2014 give AI models the right story to tell',
    ],
    whoSpecifically: [
      'Law firms (solo to mid-size)',
      'Accounting & tax practices',
      'Financial advisors',
      'Insurance agencies',
      'Real estate brokerages',
      'Consulting firms',
    ],
    cta: 'Check your firm\u2019s AI presence',
    ctaHref: '/scan',
  },
  {
    id: 'agencies',
    label: 'DIGITAL MARKETING AGENCIES',
    title: 'Your clients\u2019 next question: "What\u2019s AI saying about us?"',
    borderColor: '#00A86B',
    bgColor: 'rgba(0, 168, 107, 0.04)',
    intro:
      'You\u2019re not the end user \u2014 you\u2019re the one who adds AI visibility as a service line. Every client you manage is exposed to the same risks above. You\u2019re in the perfect position to solve it at scale.',
    risks: [
      'Your clients are already being misrepresented by AI \u2014 they just don\u2019t know it yet',
      'AI visibility is a new service line your competitors will offer if you don\u2019t',
      'Manual auditing across 20+ client locations doesn\u2019t scale',
      'Clients will churn when they realize AI is costing them customers and you weren\u2019t monitoring it',
    ],
    features: [
      'White-label reporting \u2014 brand the dashboard as your own',
      'Multi-location management \u2014 up to 10 locations per account',
      'Team seats with role-based access \u2014 assign clients to team members',
      'API access (REST + webhooks) \u2014 integrate into your existing stack',
      'Agency dashboard \u2014 all clients in one view',
      'Dedicated onboarding + account manager',
    ],
    whoSpecifically: [
      'Digital marketing agencies',
      'SEO & local SEO consultants',
      'Healthcare & dental marketing agencies',
      'Home services marketing firms',
      'Multi-location franchise operators',
      'Multi-vertical local business agencies',
    ],
    cta: 'Talk to us about agency pricing',
    ctaHref: 'mailto:hello@localvector.ai',
    callout: {
      text: 'The math: Buy at $449/mo. Bill each client $200\u2013$500/mo per location. With 3 clients, you\u2019re profitable. With 10, that\u2019s $2,000\u2013$5,000/mo in recurring revenue at 70\u201390% margin.',
    },
  },
];

// ---------------------------------------------------------------------------
// Self-qualifier data
// ---------------------------------------------------------------------------

const STRONG_FIT = [
  'You have a physical location (or serve a specific geographic area)',
  'Customers find you through search, maps, or AI assistants',
  'A wrong answer about your business costs real money',
  'You\u2019ve seen AI get your hours, services, or business details wrong',
  'You manage 1\u201310 locations and need automated monitoring',
  'You\u2019re an agency looking for a new recurring revenue service',
];

const NOT_FOR_YOU = [
  'You\u2019re a purely online/e-commerce business with no local presence',
  'You don\u2019t care what AI says about you (yet)',
  'You have an in-house team already monitoring AI outputs daily',
  'You\u2019re looking for traditional SEO \u2014 we\u2019re AI-specific',
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ForPage() {
  return (
    <>
      <MarketingNav />

      <PageHero
        label="WHO IT'S FOR"
        titleClassName="m-text-shimmer"
        title={
          <>
            If AI answers questions about your business {'\u2014'} and it
            {'\u2019'}s getting those answers wrong {'\u2014'} this is for you.
          </>
        }
        subtitle="LocalVector.ai is built for any local business where an AI model's wrong answer costs real revenue. Restaurants. Doctors. Plumbers. Lawyers. And the agencies that represent them."
      />

      {/* ── Vertical Sections ── */}
      {VERTICALS.map((v, i) => (
        <section
          key={v.id}
          className="m-section"
          style={{
            background:
              i % 2 === 0 ? 'var(--m-bg-primary)' : 'var(--m-bg-secondary)',
          }}
        >
          <div
            className={i % 2 === 0 ? 'm-reveal-left' : 'm-reveal-right'}
            style={{
              maxWidth: 1120,
              marginLeft: 'auto',
              marginRight: 'auto',
              padding: '0 24px',
            }}
          >
            <SectionLabel color={v.borderColor}>{v.label}</SectionLabel>

            <h2
              className="m-display"
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                marginBottom: 20,
                maxWidth: 700,
              }}
            >
              {v.title}
            </h2>

            <p
              style={{
                fontSize: 17,
                lineHeight: 1.7,
                color: 'var(--m-text-secondary)',
                maxWidth: 700,
                marginBottom: 40,
              }}
            >
              {v.intro}
            </p>

            {/* Callout (if present, shown before cards) */}
            {v.callout && (
              <div
                className="m-reveal"
                style={{
                  background: v.bgColor,
                  borderLeft: `4px solid ${v.borderColor}`,
                  borderRadius: 12,
                  padding: '24px 28px',
                  marginBottom: 40,
                  maxWidth: 700,
                }}
              >
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: 'var(--m-text-primary)',
                    margin: 0,
                    fontStyle: 'italic',
                  }}
                >
                  {v.callout.text}
                </p>
                {v.callout.attribution && (
                  <p
                    className="m-mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--m-text-muted)',
                      marginTop: 12,
                      marginBottom: 0,
                    }}
                  >
                    {v.callout.attribution}
                  </p>
                )}
              </div>
            )}

            {/* Two-column grid: Risks + Features */}
            <div
              className="m-for-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 24,
                marginBottom: 40,
              }}
            >
              {/* Why the risk is high */}
              <div
                className="m-card m-reveal"
                style={{
                  borderLeft: `4px solid ${v.borderColor}`,
                  borderRadius: 12,
                  padding: '28px 24px',
                }}
              >
                <h3
                  className="m-display"
                  style={{ fontSize: 18, marginBottom: 20 }}
                >
                  Why the risk is high
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {v.risks.map((r) => (
                    <li
                      key={r}
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: 'var(--m-text-secondary)',
                        padding: '6px 0',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--m-red)',
                          fontWeight: 700,
                          fontSize: 14,
                          lineHeight: '22px',
                          flexShrink: 0,
                        }}
                      >
                        {'\u2717'}
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What LocalVector does */}
              <div
                className="m-card m-reveal"
                style={{
                  borderLeft: `4px solid var(--m-green)`,
                  borderRadius: 12,
                  padding: '28px 24px',
                }}
              >
                <h3
                  className="m-display"
                  style={{ fontSize: 18, marginBottom: 20 }}
                >
                  What LocalVector does about it
                </h3>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {v.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: 'var(--m-text-secondary)',
                        padding: '6px 0',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--m-green)',
                          fontWeight: 700,
                          fontSize: 15,
                          lineHeight: '22px',
                          flexShrink: 0,
                        }}
                      >
                        {'\u2713'}
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Who specifically */}
            <div
              className="m-reveal"
              style={{
                background: v.bgColor,
                borderRadius: 12,
                padding: '24px 28px',
                marginBottom: 32,
              }}
            >
              <h4
                className="m-mono"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: v.borderColor,
                  textTransform: 'uppercase',
                  marginBottom: 16,
                }}
              >
                Who specifically
              </h4>
              <div
                className="m-who-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px 24px',
                }}
              >
                {v.whoSpecifically.map((w) => (
                  <p
                    key={w}
                    style={{
                      fontSize: 14,
                      color: 'var(--m-text-secondary)',
                      margin: 0,
                      padding: '4px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: v.borderColor,
                        flexShrink: 0,
                      }}
                    />
                    {w}
                  </p>
                ))}
              </div>
            </div>

            {/* CTA */}
            <a
              href={v.ctaHref}
              className="m-btn-primary"
              style={{
                display: 'inline-flex',
                fontSize: 15,
                padding: '14px 28px',
                textDecoration: 'none',
              }}
            >
              {v.cta} {'\u2192'}
            </a>
          </div>
        </section>
      ))}

      {/* ── Agency Script Quote ── */}
      <section
        className="m-section"
        style={{
          background: 'var(--m-bg-secondary)',
          borderTop: '1px solid var(--m-border-base)',
        }}
      >
        <div
          style={{
            maxWidth: 760,
            marginLeft: 'auto',
            marginRight: 'auto',
            padding: '0 24px',
          }}
        >
          <SectionLabel color="var(--m-green)">THE AGENCY PITCH</SectionLabel>

          <div
            className="m-card m-reveal"
            style={{
              borderLeft: '4px solid var(--m-green)',
              borderRadius: 12,
              padding: '32px 28px',
            }}
          >
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.8,
                color: 'var(--m-text-primary)',
                fontStyle: 'italic',
                margin: 0,
              }}
            >
              {'\u201C'}Hey [client], I ran an AI audit on your business. ChatGPT
              is telling people you close at 8pm on Fridays {'\u2014'} you close
              at midnight. Perplexity says you don{'\u2019'}t accept walk-ins
              when you do. And Gemini is recommending your competitor for the exact
              service you{'\u2019'}re known for. I can fix all of this and monitor it
              going forward for $299/mo. Want me to send you the report?{'\u201D'}
            </p>
            <p
              className="m-mono"
              style={{
                fontSize: 12,
                color: 'var(--m-text-muted)',
                marginTop: 20,
                marginBottom: 0,
              }}
            >
              That{'\u2019'}s the script. The audit is free. The sale closes itself.
            </p>
          </div>
        </div>
      </section>

      {/* ── Self-Qualifier ── */}
      <section
        className="m-section"
        style={{ background: 'var(--m-bg-primary)' }}
      >
        <div
          style={{
            maxWidth: 1120,
            marginLeft: 'auto',
            marginRight: 'auto',
            padding: '0 24px',
          }}
        >
          <SectionLabel color="var(--m-green)">SELF-CHECK</SectionLabel>

          <h2
            className="m-display m-reveal-scale"
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              marginBottom: 48,
              maxWidth: 600,
            }}
          >
            Is it right for you?
          </h2>

          <div
            className="m-for-grid m-reveal-stagger"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
              marginBottom: 48,
            }}
          >
            {/* Strong fit */}
            <div
              className="m-card m-reveal"
              style={{
                borderLeft: '4px solid var(--m-green)',
                borderRadius: 12,
                padding: '28px 24px',
              }}
            >
              <h3
                className="m-display"
                style={{ fontSize: 18, marginBottom: 20 }}
              >
                Strong fit
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {STRONG_FIT.map((item) => (
                  <li
                    key={item}
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: 'var(--m-text-secondary)',
                      padding: '7px 0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--m-green)',
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: '22px',
                        flexShrink: 0,
                      }}
                    >
                      {'\u2713'}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Probably not for you */}
            <div
              className="m-card m-reveal"
              style={{
                borderLeft: '4px solid var(--m-red)',
                borderRadius: 12,
                padding: '28px 24px',
              }}
            >
              <h3
                className="m-display"
                style={{ fontSize: 18, marginBottom: 20 }}
              >
                Probably not for you
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {NOT_FOR_YOU.map((item) => (
                  <li
                    key={item}
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: 'var(--m-text-secondary)',
                      padding: '7px 0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--m-red)',
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: '22px',
                        flexShrink: 0,
                      }}
                    >
                      {'\u2717'}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          background:
            'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
          padding: '80px 24px',
        }}
      >
        <h2
          className="m-display"
          style={{
            maxWidth: 700,
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: 20,
          }}
        >
          Find out what AI is saying about your business.
        </h2>
        <p
          style={{
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 32,
            maxWidth: 560,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          No account. No credit card. One scan. 8 seconds. See if AI is helping
          you or hurting you.
        </p>
        <a
          href="/scan"
          className="m-btn-primary"
          style={{ fontSize: 16, padding: '16px 36px', textDecoration: 'none' }}
        >
          Run Free AI Audit {'\u2192'}
        </a>
      </section>

      <MarketingFooter />

      {/* ── Responsive grid CSS ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 768px) {
              .m-for-grid { grid-template-columns: 1fr !important; }
              .m-who-grid { grid-template-columns: 1fr !important; }
            }
            @media (min-width: 769px) and (max-width: 1024px) {
              .m-who-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
          `,
        }}
      />
    </>
  );
}
