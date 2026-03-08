// ---------------------------------------------------------------------------
// /partners — Agency & Affiliate Partner Program Waitlist (Sprint D Marketing)
//
// Email capture form for agencies and affiliates interested in partnering.
// Reuses EmailCaptureForm pattern from /scan.
// Server Component with client form island.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import PageHero from '../_components/PageHero';
import { SectionLabel } from '../_components/MarketingShared';
import PartnerWaitlistForm from './_components/PartnerWaitlistForm';

export const metadata: Metadata = {
  title: 'Partner Program — LocalVector.ai | Agency & Affiliate Partnerships',
  description:
    'Join the LocalVector.ai partner program. Revenue share for agencies, referral bonuses ' +
    'for affiliates, co-marketing opportunities, and priority access to new features.',
  openGraph: {
    title: 'Partner with LocalVector.ai',
    description: 'Revenue share, referral bonuses, and co-marketing for agencies and affiliates.',
  },
};

// ---------------------------------------------------------------------------
// Partner benefits
// ---------------------------------------------------------------------------

const PARTNER_TYPES = [
  {
    type: 'Agency Partner',
    description: 'For digital marketing agencies managing local business clients.',
    benefits: [
      'White-label dashboard with your branding',
      'Revenue share on referred clients',
      'Co-branded marketing materials',
      'Priority feature requests',
      'Dedicated partner success manager',
      'Early access to new features',
    ],
  },
  {
    type: 'Referral Affiliate',
    description: 'For consultants, influencers, and local business advocates.',
    benefits: [
      '20% recurring commission on referrals',
      'Custom referral tracking link',
      'Monthly performance reports',
      'Promotional content library',
      'No minimum referral requirements',
      'Payouts via Stripe or PayPal',
    ],
  },
  {
    type: 'Technology Partner',
    description: 'For SaaS platforms serving the local business ecosystem.',
    benefits: [
      'API integration support',
      'Joint go-to-market campaigns',
      'Shared customer success stories',
      'Technical co-development opportunities',
      'Listing in our integration marketplace',
      'Quarterly partner reviews',
    ],
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Apply',
    description: 'Fill out the form below. We review every application within 48 hours.',
  },
  {
    step: '02',
    title: 'Onboard',
    description: 'Get your partner dashboard, referral link, and co-marketing assets.',
  },
  {
    step: '03',
    title: 'Earn',
    description: 'Start referring clients and earning revenue share from day one.',
  },
  {
    step: '04',
    title: 'Grow',
    description: 'Unlock higher tiers with more referrals. Top partners get custom terms.',
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PartnersPage() {
  return (
    <div className="lv-marketing">
      <MarketingNav />

      <PageHero
        label="Partner Program"
        title="Grow your business by protecting theirs"
        subtitle="Join the LocalVector partner program. Offer AI visibility protection to your clients, earn recurring revenue, and access tools built for scale."
      />

      {/* ── Partner Types ── */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--m-bg-primary)',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <div className="m-reveal" style={{ marginBottom: 48 }}>
            <SectionLabel>PARTNERSHIP TRACKS</SectionLabel>
            <h2
              className="m-display"
              style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                maxWidth: 600,
                marginBottom: 16,
              }}
            >
              Three ways to partner
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--m-text-secondary)', maxWidth: 600 }}>
              Whether you manage clients, refer businesses, or build integrations, there&apos;s a
              partner track designed for you.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24,
            }}
            className="m-partner-grid m-stagger-grid"
          >
            {PARTNER_TYPES.map((pt) => (
              <div
                key={pt.type}
                className="m-card m-reveal"
                style={{
                  borderRadius: 14,
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <p
                  className="m-mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--m-green)',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  {pt.type}
                </p>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: 'var(--m-text-secondary)',
                    marginBottom: 24,
                  }}
                >
                  {pt.description}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
                  {pt.benefits.map((b) => (
                    <li
                      key={b}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: 'var(--m-text-secondary)',
                        padding: '5px 0',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--m-green)',
                          fontWeight: 700,
                          fontSize: 14,
                          lineHeight: '21px',
                          flexShrink: 0,
                        }}
                      >
                        {'\u2713'}
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--m-bg-secondary)',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <div className="m-reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
            <SectionLabel>HOW IT WORKS</SectionLabel>
            <h2
              className="m-display"
              style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                marginBottom: 16,
              }}
            >
              From application to revenue in days
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 24,
            }}
            className="m-how-grid"
          >
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="m-reveal" style={{ textAlign: 'center' }}>
                <div
                  className="m-mono"
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: 'var(--m-green)',
                    marginBottom: 12,
                    opacity: 0.3,
                  }}
                >
                  {step.step}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--m-text-primary)',
                    marginBottom: 8,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--m-text-secondary)',
                  }}
                >
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Waitlist Form ── */}
      <section
        id="apply"
        style={{
          padding: '80px 24px',
          background: 'var(--m-bg-primary)',
        }}
      >
        <div
          style={{
            maxWidth: 540,
            marginLeft: 'auto',
            marginRight: 'auto',
            textAlign: 'center',
          }}
        >
          <div className="m-reveal">
            <SectionLabel>JOIN THE WAITLIST</SectionLabel>
            <h2
              className="m-display"
              style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                marginBottom: 16,
              }}
            >
              Ready to partner?
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.7,
                color: 'var(--m-text-secondary)',
                marginBottom: 32,
              }}
            >
              Enter your details and we&apos;ll reach out within 48 hours to discuss the best
              partnership track for your business.
            </p>
          </div>

          <div className="m-reveal">
            <PartnerWaitlistForm />
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          padding: '64px 24px',
          background: 'var(--m-bg-secondary)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
          <h2
            className="m-display m-text-shimmer"
            style={{
              fontSize: 'clamp(24px, 3vw, 36px)',
              marginBottom: 16,
            }}
          >
            Not ready to partner yet?
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.7,
              color: 'var(--m-text-secondary)',
              marginBottom: 32,
            }}
          >
            Try LocalVector yourself first. Run a free AI audit on any business.
          </p>
          <a
            href="/scan"
            className="m-btn-primary"
            style={{ fontSize: 14, padding: '12px 24px' }}
          >
            Run Free AI Audit {'\u2192'}
          </a>
        </div>
      </section>

      <MarketingFooter />

      {/* ── Responsive grid ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 900px) {
              .m-partner-grid { grid-template-columns: 1fr !important; }
            }
            @media (max-width: 640px) {
              .m-how-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
            @media (max-width: 420px) {
              .m-how-grid { grid-template-columns: 1fr !important; }
            }
          `,
        }}
      />
    </div>
  );
}
