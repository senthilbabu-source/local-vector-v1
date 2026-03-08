// ---------------------------------------------------------------------------
// /for/agencies — Dedicated Agency Landing Page (Marketing Sprint C)
//
// Light theme via (marketing) layout. Server Component — no 'use client'.
// ROI calculator, white-label preview, API access, seat billing, case study.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import MarketingNav from '../../_components/MarketingNav';
import MarketingFooter from '../../_components/MarketingFooter';
import PageHero from '../../_components/PageHero';
import { SectionLabel } from '../../_components/MarketingShared';

export const metadata: Metadata = {
  title:
    'LocalVector.ai for Agencies — White-Label AI Visibility Monitoring',
  description:
    'Add AI visibility monitoring as a recurring revenue service. White-label dashboard, multi-location management, API access, and team seats. From $449/month for unlimited locations.',
  openGraph: {
    title: 'LocalVector.ai for Agencies — White-Label AI Visibility',
    description:
      'Turn AI visibility into a new agency revenue stream. White-label dashboard, multi-location, API access.',
  },
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface ROIRow {
  clients: number;
  billing: string;
  monthly: string;
  annual: string;
  margin: string;
}

const ROI_TABLE: ROIRow[] = [
  { clients: 3, billing: '$200/mo each', monthly: '$600', annual: '$7,200', margin: '~55%' },
  { clients: 5, billing: '$300/mo each', monthly: '$1,500', annual: '$18,000', margin: '~70%' },
  { clients: 10, billing: '$300/mo each', monthly: '$3,000', annual: '$36,000', margin: '~85%' },
  { clients: 20, billing: '$400/mo each', monthly: '$8,000', annual: '$96,000', margin: '~90%' },
];

interface Feature {
  title: string;
  description: string;
}

const PLATFORM_FEATURES: Feature[] = [
  {
    title: 'White-Label Dashboard',
    description:
      'Your brand. Your colors. Your domain. Clients see your agency name, not ours. Custom logos, color schemes, and branded login URLs.',
  },
  {
    title: 'Multi-Location Management',
    description:
      'Manage up to 10 locations per account from a single dashboard. Switch between clients instantly. Bulk operations across all locations.',
  },
  {
    title: 'Team Seats with Roles',
    description:
      'Assign team members as owners, admins, or viewers. Each team member sees only their assigned clients. Role-based access controls.',
  },
  {
    title: 'REST API + Webhooks',
    description:
      'Integrate LocalVector data into your existing reporting stack. Webhook alerts for hallucination detection, score changes, and new competitor threats.',
  },
  {
    title: 'Automated Weekly Reports',
    description:
      'Branded email digests sent to your clients automatically. Reality Score trends, hallucination fixes, and competitor intelligence — all under your brand.',
  },
  {
    title: 'Priority Support + Onboarding',
    description:
      'Dedicated onboarding call, migration assistance, and priority email support. We help you sell, pitch, and deliver the service.',
  },
];

const CLIENT_PITCH_STEPS = [
  { step: 1, action: 'Run a free AI audit', detail: 'Use /scan to pull a real report for the prospect. Takes 8 seconds. Show them what AI is getting wrong.' },
  { step: 2, action: 'Show the damage', detail: 'Wrong hours, wrong menu items, competitor recommendations — quantify the revenue impact in dollars per month.' },
  { step: 3, action: 'Offer the fix', detail: '"I can monitor and fix this for $200–$500/mo." You buy at $449/mo agency pricing. You bill per location. Profitable from client #3.' },
  { step: 4, action: 'Deliver automatically', detail: 'Dashboard does the monitoring. Weekly reports go out under your brand. You upsell content and schema fixes.' },
];

const WHAT_YOU_MONITOR = [
  'AI hallucination detection across ChatGPT, Perplexity, Gemini, Copilot, Grok, You.com',
  'Share of Voice tracking — who AI recommends and why',
  'NAP consistency across the Big 6 listing platforms',
  'Structured data health (JSON-LD, llms.txt, ai-config.json)',
  'AI sentiment analysis — how AI frames the business',
  'Competitor intelligence and vulnerability alerts',
  'Review intelligence with AI-powered response drafts',
  'Google AI Overview monitoring via Search Console',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgenciesPage() {
  return (
    <>
      <MarketingNav />

      <PageHero
        label="FOR AGENCIES"
        titleClassName="m-text-shimmer"
        title={<>Turn AI visibility into your next recurring revenue line.</>}
        subtitle="Your clients are already being misrepresented by AI. They just don't know it yet. Be the agency that finds the problem — and fixes it at scale."
      />

      {/* ── ROI Calculator ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">THE MATH</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: 16, maxWidth: 700 }}>
            Profitable from client #3
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--m-text-secondary)', marginBottom: 40, maxWidth: 700 }}>
            You buy Brand Fortress at $449/month. You bill each client $200–$500/month per location.
            Here&apos;s what the numbers look like:
          </p>

          <div className="m-card m-reveal" style={{ borderRadius: 12, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--m-bg-secondary)', borderBottom: '1px solid var(--m-border-base)' }}>
                  {['Clients', 'You Bill', 'Monthly Rev', 'Annual Rev', 'Margin'].map((h) => (
                    <th key={h} className="m-mono" style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--m-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROI_TABLE.map((row) => (
                  <tr key={row.clients} style={{ borderBottom: '1px solid var(--m-border-base)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--m-text-primary)' }}>{row.clients} clients</td>
                    <td style={{ padding: '14px 20px', color: 'var(--m-text-secondary)' }}>{row.billing}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--m-green)', fontWeight: 600 }}>{row.monthly}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--m-green)', fontWeight: 600 }}>{row.annual}</td>
                    <td style={{ padding: '14px 20px', color: 'var(--m-text-secondary)' }}>{row.margin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="m-mono" style={{ fontSize: 12, color: 'var(--m-text-muted)', marginTop: 16 }}>
            Your cost: $449/mo flat. Revenue scales linearly with clients. No per-seat surcharges below 5 team members.
          </p>
        </div>
      </section>

      {/* ── What You Monitor ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal-left" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">CAPABILITIES</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', marginBottom: 16, maxWidth: 700 }}>
            Everything you monitor for each client
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--m-text-secondary)', marginBottom: 40, maxWidth: 700 }}>
            One dashboard. Every AI engine. Every signal. Automated.
          </p>

          <div className="m-agency-caps-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {WHAT_YOU_MONITOR.map((item) => (
              <div key={item} className="m-card m-reveal" style={{ padding: '20px 24px', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ color: 'var(--m-green)', fontWeight: 700, fontSize: 16, lineHeight: '24px', flexShrink: 0 }}>{'\u2713'}</span>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--m-text-secondary)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Features ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div className="m-reveal-right" style={{ maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">AGENCY PLATFORM</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', marginBottom: 40, maxWidth: 700 }}>
            Built for agencies, not bolted on
          </h2>

          <div className="m-agency-feat-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {PLATFORM_FEATURES.map((feat) => (
              <div key={feat.title} className="m-card m-reveal" style={{ borderLeft: '4px solid var(--m-green)', borderRadius: 12, padding: '28px 24px' }}>
                <h3 className="m-display" style={{ fontSize: 18, marginBottom: 12 }}>{feat.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--m-text-secondary)', margin: 0 }}>{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Client Pitch Playbook ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-secondary)' }}>
        <div className="m-reveal" style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">THE PLAYBOOK</SectionLabel>
          <h2 className="m-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', marginBottom: 16, maxWidth: 700 }}>
            How to sell AI visibility to your clients
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--m-text-secondary)', marginBottom: 40, maxWidth: 700 }}>
            Four steps. The audit is free. The sale closes itself.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {CLIENT_PITCH_STEPS.map((s) => (
              <div key={s.step} className="m-card m-reveal" style={{ borderRadius: 12, padding: '28px 24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--m-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
                  {s.step}
                </div>
                <div>
                  <h3 className="m-display" style={{ fontSize: 18, marginBottom: 8 }}>{s.action}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--m-text-secondary)', margin: 0 }}>{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Script ── */}
      <section className="m-section" style={{ background: 'var(--m-bg-primary)' }}>
        <div style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          <SectionLabel color="var(--m-green)">THE SCRIPT</SectionLabel>
          <div className="m-card m-reveal" style={{ borderLeft: '4px solid var(--m-green)', borderRadius: 12, padding: '32px 28px' }}>
            <p style={{ fontSize: 17, lineHeight: 1.8, color: 'var(--m-text-primary)', fontStyle: 'italic', margin: 0 }}>
              {'\u201C'}Hey [client], I ran an AI audit on your business. ChatGPT is telling people you close at 8pm on Fridays
              {' \u2014 '}you close at midnight. Perplexity says you don{'\u2019'}t accept walk-ins when you do.
              And Gemini is recommending your competitor for the exact service you{'\u2019'}re known for.
              I can fix all of this and monitor it going forward for $299/mo. Want me to send you the report?{'\u201D'}
            </p>
            <p className="m-mono" style={{ fontSize: 12, color: 'var(--m-text-muted)', marginTop: 20, marginBottom: 0 }}>
              That{'\u2019'}s the script. The audit is free. The sale closes itself.
            </p>
          </div>
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
        <h2 className="m-display" style={{ maxWidth: 700, marginLeft: 'auto', marginRight: 'auto', marginBottom: 20 }}>
          Start your agency trial today.
        </h2>
        <p style={{ color: 'var(--m-text-secondary)', fontSize: 17, lineHeight: 1.7, marginBottom: 32, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
          White-label dashboard. Multi-location. API access. Team seats.
          Everything you need to sell AI visibility as a service.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signup?plan=agency" className="m-btn-primary" style={{ fontSize: 16, padding: '16px 36px', textDecoration: 'none' }}>
            Start Agency Trial {'\u2192'}
          </a>
          <a href="/scan" className="m-btn-secondary" style={{ fontSize: 16, padding: '16px 36px', textDecoration: 'none' }}>
            Run a Free Client Audit
          </a>
        </div>
      </section>

      <MarketingFooter />

      {/* ── Responsive ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .m-agency-caps-grid { grid-template-columns: 1fr !important; }
          .m-agency-feat-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </>
  );
}
