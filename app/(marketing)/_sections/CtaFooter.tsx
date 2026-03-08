// ---------------------------------------------------------------------------
// Section 10 + 11: "Final CTA + Footer" — Light theme Server Component
// ---------------------------------------------------------------------------

import { SectionLabel } from '../_components/MarketingShared';
import LogoMark from '../_components/LogoMark';
import ViralScanner from '../../_components/ViralScanner';

export default function CtaFooter() {
  return (
    <>
      {/* ---- Section 10: Final CTA ---- */}
      <section
        className="m-section"
        style={{
          background: 'linear-gradient(160deg, #F0F4E8 0%, #E4F5EC 50%, #E8F0F8 100%)',
          textAlign: 'center',
        }}
      >
        <div className="m-reveal">
        <SectionLabel>ONE QUESTION</SectionLabel>

        <h2
          className="m-display m-text-shimmer"
          style={{
            maxWidth: 800,
            marginLeft: 'auto',
            marginRight: 'auto',
            marginBottom: 20,
            fontWeight: 800,
          }}
        >
          Right now, AI is describing your business to someone. Is it telling the
          truth?
        </h2>

        <p
          style={{
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
            color: 'var(--m-text-secondary)',
            fontSize: 17,
            lineHeight: 1.7,
            marginBottom: 40,
          }}
        >
          Find out in 8 seconds. No account required.
        </p>
        </div>

        <div className="m-reveal" style={{ maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
          <ViralScanner variant="light" />
        </div>

        <p
          className="m-mono"
          style={{
            marginTop: 24,
            fontSize: 13,
            color: 'var(--m-text-muted)',
          }}
        >
          Free. Instant. Real results from real AI models.
        </p>
      </section>

      {/* ---- Section 11: Footer ---- */}
      <footer
        style={{
          background: '#0B1629',
          color: '#fff',
          padding: '64px 24px 32px',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 48,
          }}
        >
          {/* ---- Column 1: Brand ---- */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ color: '#00A86B' }}><LogoMark size={24} /></span>
              <p
                className="m-display"
                style={{ fontSize: 20, color: '#fff', margin: 0 }}
              >
                LocalVector.ai
              </p>
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: 'rgba(148,163,184,0.9)',
              }}
            >
              Defending the truth for local business.
              <br />
              Built for the generative age.
            </p>
          </div>

          {/* ---- Column 2: Product ---- */}
          <div>
            <FooterHeading>Product</FooterHeading>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/for">Who It&apos;s For</FooterLink>
            <FooterLink href="/how-it-works">How It Works</FooterLink>
            <FooterLink href="/for/agencies">For Agencies</FooterLink>
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/changelog">Changelog</FooterLink>
            <FooterLink href="/scan">Free AI Audit</FooterLink>
          </div>

          {/* ---- Column 3: Resources ---- */}
          <div>
            <FooterHeading>Resources</FooterHeading>
            <FooterLink href="/blog">Blog</FooterLink>
            <FooterLink href="/what-is/aeo">What is AEO?</FooterLink>
            <FooterLink href="/what-is/geo">What is GEO?</FooterLink>
            <FooterLink href="/what-is/ai-hallucination">
              What is an AI Hallucination?
            </FooterLink>
            <FooterLink href="/what-is/agent-seo">What is Agent SEO?</FooterLink>
            <FooterLink href="/what-is/share-of-voice-ai">AI Share of Voice</FooterLink>
            <FooterLink href="/what-is/ai-overview">Google AI Overview</FooterLink>
            <FooterLink href="/what-is/siri-readiness">Siri Readiness</FooterLink>
            <FooterLink href="/glossary">Glossary</FooterLink>
            <FooterLink href="/case-studies">Case Studies</FooterLink>
            <FooterLink href="/compare/localvector-vs-yext">vs Yext</FooterLink>
            <FooterLink href="/compare/localvector-vs-brightlocal">vs BrightLocal</FooterLink>
            <FooterLink href="/partners">Partners</FooterLink>
          </div>

          {/* ---- Column 4: Legal ---- */}
          <div>
            <FooterHeading>Legal</FooterHeading>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <FooterLink href="mailto:hello@localvector.ai">
              hello@localvector.ai
            </FooterLink>
          </div>
        </div>

        {/* ---- Bottom copyright ---- */}
        <div
          style={{
            maxWidth: 1100,
            marginLeft: 'auto',
            marginRight: 'auto',
            borderTop: '1px solid rgba(148,163,184,0.15)',
            marginTop: 48,
            paddingTop: 24,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: 'rgba(148,163,184,0.6)',
              margin: 0,
            }}
          >
            &copy; 2026 LocalVector.ai &mdash; The AI Visibility Platform for
            Local Business
          </p>
        </div>
      </footer>
    </>
  );
}

/* ---- Helper sub-components ---- */

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="m-mono"
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: 'rgba(148,163,184,0.5)',
        textTransform: 'uppercase',
        marginBottom: 16,
      }}
    >
      {children}
    </p>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        fontSize: 14,
        color: 'rgba(226,232,240,0.85)',
        textDecoration: 'none',
        marginBottom: 10,
        lineHeight: 1.5,
      }}
    >
      {children}
    </a>
  );
}
