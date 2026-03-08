// ---------------------------------------------------------------------------
// /pricing — Full Pricing Page (Website Content Strategy v2.0 — Phase 2)
//
// Light theme via (marketing) layout. 4 tiers, feature comparison, FAQ.
// No auth required. No Stripe calls — pure marketing page.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../_components/MarketingNav';
import MarketingFooter from '../_components/MarketingFooter';
import { SectionLabel } from '../_components/MarketingShared';

export const metadata: Metadata = {
  title: 'Pricing — LocalVector.ai | AI Hallucination Detection for Local Businesses',
  description:
    'Transparent pricing for AI visibility protection. Free audit, $79/month Starter, ' +
    '$229/month AI Shield, $649/month Brand Fortress, and Enterprise plans. Start with a free AI hallucination scan.',
};

// ---------------------------------------------------------------------------
// Tier data
// ---------------------------------------------------------------------------

interface Tier {
  id: string;
  name: string;
  price: string;
  annual?: string;
  annualLabel?: string;
  period: string;
  tagline: string;
  scanFrequency?: string;
  features: string[];
  notIncluded?: string[];
  whoItsFor: string;
  roiFrame?: string;
  cta: string;
  ctaHref: string;
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'The Audit',
    price: 'Free',
    period: '',
    tagline: 'Start here. See the damage. No commitment.',
    features: [
      'One free AI hallucination scan',
      'Real-time responses from ChatGPT, Perplexity, and Gemini',
      'AI Mentions volume analysis',
      'AI Sentiment snapshot',
      'Accuracy issue highlights',
      'No account required',
    ],
    notIncluded: ['Automated monitoring', 'Reality Score', 'Competitor Intercept', 'Magic Menu'],
    whoItsFor: 'Any business owner who wants to know what AI is saying about them before spending a dollar.',
    cta: 'Start Free Audit',
    ctaHref: '/#scanner',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$79',
    annual: '$63',
    annualLabel: '$63/mo billed annually (save 20%)',
    period: '/mo',
    tagline: 'Stop the bleeding. Automated protection for one location.',
    scanFrequency: 'Scans every 3 days',
    features: [
      'Web-grounded AI audits (ChatGPT live, Perplexity, Gemini, Copilot)',
      'Reality Score dashboard',
      'Email hallucination alerts (within 24hrs)',
      'Magic Menu \u2014 PDF to AI-readable JSON-LD',
      'llms.txt + ai-config.json generation',
      'Google Business Profile sync',
      'Citation accuracy monitoring',
    ],
    notIncluded: ['Daily scans', 'Competitor Intercept', 'Share of Voice'],
    whoItsFor: 'Business owners who want automated protection and immediate alerts when something goes wrong.',
    roiFrame: 'One corrected hallucination pays for 3+ months of Starter.',
    cta: 'Get Started',
    ctaHref: '/signup',
  },
  {
    id: 'growth',
    name: 'AI Shield',
    price: '$229',
    annual: '$183',
    annualLabel: '$183/mo billed annually (save 20%)',
    period: '/mo',
    tagline: 'Go on offense. Detect problems AND take the lead from competitors.',
    scanFrequency: 'Daily automated scans',
    features: [
      'Everything in Starter',
      'Daily automated AI audits across all 4 engines',
      'Competitor Intercept \u2014 why competitors win AI recommendations',
      'Share of Voice tracking vs. 3 competitors',
      'AI Sentiment tracking',
      'Content action recommendations',
      'Revenue Impact scoring',
      'Priority email support',
    ],
    whoItsFor: 'Competitive business owners who want to monitor AND outperform their competition in AI results.',
    roiFrame: 'Recovering from one competitor intercept pays for 6+ months of AI Shield.',
    cta: 'Get AI Shield',
    ctaHref: '/signup',
    popular: true,
  },
  {
    id: 'agency',
    name: 'Brand Fortress',
    price: '$649',
    annual: '$519',
    annualLabel: '$519/mo billed annually (save 20%)',
    period: '/mo',
    tagline: 'For agencies and multi-location operators who manage AI presence at scale.',
    scanFrequency: 'Daily scans across all locations',
    features: [
      'Everything in AI Shield',
      'Up to 10 locations',
      'White-label reporting',
      'Team seats with role-based access',
      'Agency dashboard \u2014 all clients in one view',
      'API access (REST + webhooks)',
      'Dedicated onboarding + account manager',
      'Custom AI query templates',
    ],
    whoItsFor: 'Digital marketing agencies, multi-location brands, and franchise operators protecting consistency across locations.',
    cta: 'Contact Sales',
    ctaHref: 'mailto:hello@localvector.ai',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    tagline: '10+ locations, SLA guarantees, white-glove onboarding, and custom integrations. Starting at $1,500/mo.',
    scanFrequency: 'Real-time / on-demand',
    features: [
      'Everything in Brand Fortress',
      'Unlimited locations',
      'Custom SLA guarantees',
      'Dedicated infrastructure',
      'Custom AI engine integrations',
      'Quarterly business reviews',
      'Priority phone + Slack support',
      'Volume pricing',
    ],
    whoItsFor: 'Large multi-location brands and enterprise operators who need custom infrastructure and dedicated support.',
    cta: 'Talk to Us',
    ctaHref: 'mailto:hello@localvector.ai',
  },
];

// ---------------------------------------------------------------------------
// Feature comparison data
// ---------------------------------------------------------------------------

interface FeatureRow {
  feature: string;
  free: string;
  starter: string;
  shield: string;
  agency: string;
  enterprise: string;
}

const FEATURE_ROWS: FeatureRow[] = [
  { feature: 'AI Hallucination Scan', free: 'Once', starter: 'Every 3 days', shield: 'Daily', agency: 'Daily', enterprise: 'Real-time' },
  { feature: 'AI Models Monitored', free: '3', starter: '4', shield: '4', agency: '4', enterprise: 'Custom' },
  { feature: 'Reality Score Dashboard', free: '\u2717', starter: '\u2713', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'Email Hallucination Alerts', free: '\u2717', starter: '\u2713', shield: 'Priority', agency: 'Priority', enterprise: 'Priority' },
  { feature: 'Magic Menu (PDF \u2192 JSON-LD)', free: '\u2717', starter: '\u2713', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'llms.txt + AI Config', free: '\u2717', starter: '\u2713', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'GBP Sync', free: '\u2717', starter: '\u2713', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'Citation Accuracy Monitoring', free: '\u2717', starter: '\u2713', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'Competitor Intercept', free: '\u2717', starter: '\u2717', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'Share of Voice Tracking', free: '\u2717', starter: '\u2717', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'AI Sentiment Tracking', free: '\u2717', starter: '\u2717', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'Revenue Impact Scoring', free: '\u2717', starter: '\u2717', shield: '\u2713', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'White-Label Reports', free: '\u2717', starter: '\u2717', shield: '\u2717', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'Team Seats', free: '\u2717', starter: '\u2717', shield: '\u2717', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'API Access', free: '\u2717', starter: '\u2717', shield: '\u2717', agency: '\u2713', enterprise: '\u2713' },
  { feature: 'Custom SLA', free: '\u2717', starter: '\u2717', shield: '\u2717', agency: '\u2717', enterprise: '\u2713' },
  { feature: 'Dedicated Infrastructure', free: '\u2717', starter: '\u2717', shield: '\u2717', agency: '\u2717', enterprise: '\u2713' },
  { feature: 'Locations', free: '\u2014', starter: '1', shield: '1', agency: 'Up to 10', enterprise: 'Unlimited' },
];

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

const PRICING_FAQ = [
  {
    q: 'Is there a free trial?',
    a: 'Yes. All paid plans include a 14-day free trial, no credit card required. You can also run a one-time free AI audit at any time at no cost.',
  },
  {
    q: 'What happens after the free trial?',
    a: "At the end of 14 days, you'll be prompted to enter payment details to continue. If you don't, your account moves to free tier (audit access only). No charges without your explicit confirmation.",
  },
  {
    q: 'Can I change plans?',
    a: 'Yes, at any time. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.',
  },
  {
    q: 'What does "1 location" mean?',
    a: "One Google Business Profile / one business address. If you own multiple locations, Brand Fortress supports up to 10, and Enterprise offers unlimited locations.",
  },
  {
    q: 'Is my business data private?',
    a: 'Yes. Your business data is encrypted, never sold, and never shared with third parties. See our Privacy Policy for full details.',
  },
  {
    q: 'Do you offer refunds?',
    a: "If LocalVector detects zero hallucinations and zero issues with your AI visibility in the first 30 days, we'll refund your first month \u2014 no questions asked.",
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PricingPage() {
  return (
    <>
      <MarketingNav />

      {/* ── Hero ── */}
      <section
        style={{
          background: 'linear-gradient(160deg, #F5F7ED 0%, #E8F5EE 40%, #F0F4F8 100%)',
          paddingTop: 72,
          paddingBottom: 64,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">PRICING</SectionLabel>

          <h1
            className="m-display m-text-shimmer"
            style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              marginBottom: 20,
            }}
          >
            Protect your AI presence. Own the recommendation.
          </h1>

          <p
            style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: 'var(--m-text-secondary)',
              maxWidth: 640,
              marginLeft: 'auto',
              marginRight: 'auto',
              marginBottom: 12,
            }}
          >
            Every plan uses live, web-grounded AI scans {'\u2014'} not cached model data.
            You see what your customers see, in real time.
          </p>

          <p
            className="m-mono"
            style={{
              fontSize: 13,
              color: 'var(--m-text-muted)',
              marginTop: 20,
            }}
          >
            14-day free trial on all paid plans {'\u00B7'} No contracts {'\u00B7'} Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Tier Cards ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)', paddingTop: 64 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 20,
          }}
          className="m-pricing-grid m-stagger-grid"
        >
          {TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>
      </section>

      {/* ── Feature Comparison Table ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <h2
          className="m-display"
          style={{ textAlign: 'center', marginBottom: 48, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}
        >
          Compare all plans
        </h2>

        <div
          className="m-reveal-scale"
          style={{
            overflowX: 'auto',
            borderRadius: 12,
            border: '1px solid var(--m-border-base)',
            background: 'var(--m-bg-card)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
            <thead>
              <tr style={{ background: '#EEF2F7' }}>
                <th style={thStyle}>Feature</th>
                <th style={{ ...thStyleCenter, width: 90 }}>Free</th>
                <th style={{ ...thStyleCenter, width: 90 }}>Starter</th>
                <th style={{ ...thStyleCenter, width: 90, color: 'var(--m-green)' }}>AI Shield</th>
                <th style={{ ...thStyleCenter, width: 110 }}>Brand Fortress</th>
                <th style={{ ...thStyleCenter, width: 100 }}>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                  <td style={tdStyle}>{row.feature}</td>
                  <td style={tdCenter}><CellVal v={row.free} /></td>
                  <td style={tdCenter}><CellVal v={row.starter} /></td>
                  <td style={tdCenter}><CellVal v={row.shield} highlight /></td>
                  <td style={tdCenter}><CellVal v={row.agency} /></td>
                  <td style={tdCenter}><CellVal v={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Pricing FAQ ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <h2 className="m-display" style={{ maxWidth: 400, marginBottom: 48 }}>
          Pricing questions
        </h2>

        <div style={{ maxWidth: 740 }}>
          {PRICING_FAQ.map((item, i) => (
            <details
              key={i}
              className="m-reveal"
              style={{ borderBottom: i === PRICING_FAQ.length - 1 ? 'none' : '1px solid var(--m-border-base)' }}
            >
              <summary
                className="m-faq-summary"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: 'var(--m-text-primary)',
                  padding: '20px 32px 20px 0',
                  cursor: 'pointer',
                  listStyle: 'none',
                  position: 'relative',
                }}
              >
                {item.q}
                <span
                  aria-hidden="true"
                  className="m-faq-chevron"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 20,
                    color: 'var(--m-text-muted)',
                    transition: 'transform 0.2s',
                    fontWeight: 300,
                  }}
                >
                  +
                </span>
              </summary>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--m-text-secondary)', paddingBottom: 20, marginTop: 0 }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        style={{
          background: 'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
          padding: '80px 24px',
        }}
      >
        <h2
          className="m-display m-text-shimmer"
          style={{
            maxWidth: 700,
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: 20,
          }}
        >
          Still not sure? Start with the free audit.
        </h2>
        <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32 }}>
          See what AI is saying about your business right now. No account. No credit card. 8 seconds.
        </p>
        <a href="/#scanner" className="m-btn-primary" style={{ fontSize: 16, padding: '16px 36px' }}>
          Run Free AI Audit {'\u2192'}
        </a>
      </section>

      <MarketingFooter />

      {/* ── Responsive grid CSS ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1280px) {
              .m-pricing-grid { grid-template-columns: repeat(3, 1fr) !important; }
            }
            @media (max-width: 900px) {
              .m-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
            @media (max-width: 640px) {
              .m-pricing-grid { grid-template-columns: 1fr !important; }
            }
          `,
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// TierCard sub-component
// ---------------------------------------------------------------------------

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className="m-card m-reveal"
      style={{
        borderRadius: 14,
        position: 'relative',
        border: tier.popular ? '2px solid var(--m-green)' : '1px solid var(--m-border-base)',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 28px',
      }}
    >
      {tier.popular && (
        <span
          className="m-mono"
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--m-green)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '4px 14px',
            borderRadius: 100,
            whiteSpace: 'nowrap',
          }}
        >
          MOST POPULAR
        </span>
      )}

      {/* Plan name */}
      <p
        className="m-mono"
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: 'var(--m-text-muted)',
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        {tier.name}
      </p>

      {/* Price */}
      <div style={{ marginBottom: 8 }}>
        <span
          className="m-display"
          style={{ fontSize: tier.price === 'Free' ? 36 : 42 }}
        >
          {tier.price}
        </span>
        {tier.period && (
          <span style={{ fontSize: 16, color: 'var(--m-text-muted)', fontWeight: 400 }}>
            {tier.period}
          </span>
        )}
      </div>

      {/* Annual price */}
      {tier.annualLabel && (
        <p className="m-mono" style={{ fontSize: 12, color: 'var(--m-green)', fontWeight: 600, marginBottom: 8 }}>
          {tier.annualLabel}
        </p>
      )}

      {/* Scan frequency */}
      {tier.scanFrequency && (
        <p
          className="m-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--m-green)',
            background: 'var(--m-green-light)',
            borderRadius: 100,
            padding: '4px 12px',
            marginBottom: 12,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--m-green)', display: 'block' }} />
          {tier.scanFrequency}
        </p>
      )}

      {/* Tagline */}
      <p style={{ fontSize: 14, color: 'var(--m-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
        {tier.tagline}
      </p>

      {/* Features */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, marginBottom: 24 }}>
        {tier.features.map((f) => (
          <li
            key={f}
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: 'var(--m-text-secondary)',
              padding: '5px 0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span style={{ color: 'var(--m-green)', fontWeight: 700, fontSize: 15, lineHeight: '20px', flexShrink: 0 }}>
              {'\u2713'}
            </span>
            {f}
          </li>
        ))}
      </ul>

      {/* Not included */}
      {tier.notIncluded && (
        <div style={{ marginBottom: 20 }}>
          {tier.notIncluded.map((ni) => (
            <p
              key={ni}
              style={{
                fontSize: 12,
                color: 'var(--m-text-muted)',
                padding: '2px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ color: 'var(--m-text-muted)', fontSize: 12 }}>{'\u2717'}</span>
              {ni}
            </p>
          ))}
        </div>
      )}

      {/* ROI frame */}
      {tier.roiFrame && (
        <p
          style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: 'var(--m-green-dark)',
            background: 'var(--m-green-light)',
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {tier.roiFrame}
        </p>
      )}

      {/* Who it's for */}
      <p style={{ fontSize: 12, color: 'var(--m-text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
        <strong style={{ color: 'var(--m-text-secondary)' }}>Who it{'\u2019'}s for:</strong> {tier.whoItsFor}
      </p>

      {/* CTA */}
      <a
        href={tier.ctaHref}
        className={tier.popular ? 'm-btn-primary' : 'm-btn-secondary'}
        style={{ textAlign: 'center', textDecoration: 'none', width: '100%' }}
      >
        {tier.cta} {'\u2192'}
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table cell value renderer
// ---------------------------------------------------------------------------

function CellVal({ v, highlight }: { v: string; highlight?: boolean }) {
  if (v === '\u2713') {
    return <span style={{ color: highlight ? 'var(--m-green)' : 'var(--m-green)', fontSize: 18, fontWeight: 700 }}>{v}</span>;
  }
  if (v === '\u2717') {
    return <span style={{ color: 'var(--m-text-muted)', fontSize: 16, opacity: 0.5 }}>{'\u2014'}</span>;
  }
  return (
    <span
      className="m-mono"
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: highlight ? 'var(--m-green)' : 'var(--m-text-secondary)',
      }}
    >
      {v}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table styles
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px 20px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--m-text-primary)',
  borderBottom: '1px solid var(--m-border-base)',
};

const thStyleCenter: React.CSSProperties = {
  ...thStyle,
  textAlign: 'center',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 20px',
  fontSize: 14,
  color: 'var(--m-text-primary)',
  borderBottom: '1px solid var(--m-border-base)',
};

const tdCenter: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
};
