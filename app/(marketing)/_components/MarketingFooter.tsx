// ---------------------------------------------------------------------------
// Shared Marketing Footer — reusable across all marketing pages
// ---------------------------------------------------------------------------

import React from 'react';
import LogoMark from './LogoMark';

export default function MarketingFooter() {
  return (
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 48,
        }}
      >
        {/* Brand */}
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

        {/* Product */}
        <div>
          <FooterHeading>Product</FooterHeading>
          <FooterLink href="/pricing">Pricing</FooterLink>
          <FooterLink href="/for">Who It&apos;s For</FooterLink>
          <FooterLink href="/how-it-works">How It Works</FooterLink>
          <FooterLink href="/about">About</FooterLink>
          <FooterLink href="/scan">Free AI Audit</FooterLink>
        </div>

        {/* Resources */}
        <div>
          <FooterHeading>Resources</FooterHeading>
          <FooterLink href="/what-is/aeo">What is AEO?</FooterLink>
          <FooterLink href="/what-is/geo">What is GEO?</FooterLink>
          <FooterLink href="/what-is/ai-hallucination">What is an AI Hallucination?</FooterLink>
          <FooterLink href="/what-is/agent-seo">What is Agent SEO?</FooterLink>
          <FooterLink href="/what-is/share-of-voice-ai">What is AI Share of Voice?</FooterLink>
          <FooterLink href="/glossary">Glossary</FooterLink>
          <FooterLink href="/case-studies">Case Studies</FooterLink>
        </div>

        {/* Legal */}
        <div>
          <FooterHeading>Legal</FooterHeading>
          <FooterLink href="/privacy">Privacy Policy</FooterLink>
          <FooterLink href="/terms">Terms of Service</FooterLink>
          <FooterLink href="mailto:hello@localvector.ai">
            hello@localvector.ai
          </FooterLink>
        </div>
      </div>

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
  );
}

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
