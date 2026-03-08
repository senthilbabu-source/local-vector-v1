// ---------------------------------------------------------------------------
// Shared Marketing Navigation Bar — reusable across all marketing pages
// ---------------------------------------------------------------------------

import React from 'react';
import LogoMark from './LogoMark';

const navLinkStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--m-text-secondary)',
  textDecoration: 'none',
};

export default function MarketingNav() {
  return (
    <>
      <nav
        className="m-nav-bar"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: '1px solid var(--m-border-base)',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            marginLeft: 'auto',
            marginRight: 'auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 22,
              fontWeight: 800,
              textDecoration: 'none',
              color: '#0B1629',
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ color: '#00A86B' }}><LogoMark size={28} /></span>
            LocalVector
            <span style={{ color: '#00A86B', marginLeft: -6 }}>.ai</span>
          </a>

          <a
            href="/scan"
            className="m-btn-primary m-mobile-cta"
            style={{ fontSize: 13, padding: '10px 18px' }}
          >
            Free Audit &rarr;
          </a>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 28,
            }}
            className="m-nav-links"
          >
            <a href="/how-it-works" style={navLinkStyle}>
              How It Works
            </a>
            <a href="/pricing" style={navLinkStyle}>
              Pricing
            </a>
            <a href="/for" style={navLinkStyle}>
              Who It&apos;s For
            </a>

            {/* Resources dropdown */}
            <div className="m-nav-dropdown">
              <button
                type="button"
                style={{
                  ...navLinkStyle,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Resources
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true" style={{ marginTop: 1 }}>
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="m-nav-dropdown-menu">
                <p className="m-nav-dropdown-label">Learn</p>
                <a href="/what-is/aeo" className="m-nav-dropdown-item">What is AEO?</a>
                <a href="/what-is/geo" className="m-nav-dropdown-item">What is GEO?</a>
                <a href="/what-is/ai-hallucination" className="m-nav-dropdown-item">AI Hallucinations</a>
                <a href="/what-is/share-of-voice-ai" className="m-nav-dropdown-item">AI Share of Voice</a>
                <a href="/what-is/agent-seo" className="m-nav-dropdown-item">Agent SEO</a>
                <div style={{ height: 1, background: 'var(--m-border-base)', margin: '8px 0' }} />
                <p className="m-nav-dropdown-label">Company</p>
                <a href="/case-studies" className="m-nav-dropdown-item">Case Studies</a>
                <a href="/glossary" className="m-nav-dropdown-item">Glossary</a>
                <a href="/about" className="m-nav-dropdown-item">About</a>
              </div>
            </div>

            <a href="/login" style={navLinkStyle}>
              Log In
            </a>
            <a href="/scan" className="m-btn-primary" style={{ fontSize: 14 }}>
              Run Free AI Audit &rarr;
            </a>
          </div>
        </div>

        <div
          className="m-trust-bar"
          style={{
            borderTop: '1px solid var(--m-border-base)',
            backgroundColor: '#F1F5F9',
          }}
        >
          <div
            style={{
              maxWidth: 1120,
              marginLeft: 'auto',
              marginRight: 'auto',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 36,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 11,
              color: 'var(--m-text-muted)',
              letterSpacing: '0.02em',
            }}
          >
            Live monitoring &middot; ChatGPT &middot; Gemini &middot; Perplexity &middot; Claude
            &middot; Copilot &middot; Protecting 1,200+ local businesses &mdash; restaurants, clinics, salons, law firms &amp; more
          </div>
        </div>
      </nav>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .m-nav-bar {
              background-color: rgba(255,255,255,0.92);
              -webkit-backdrop-filter: saturate(180%) blur(16px);
              backdrop-filter: saturate(180%) blur(16px);
            }
            @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
              .m-nav-bar { background-color: #FFFFFF; }
            }
            .m-trust-bar { display: none; }
            .m-nav-links { display: none !important; }
            .m-mobile-cta { display: inline-flex !important; }
            @media (min-width: 768px) {
              .m-trust-bar { display: block; }
              .m-nav-links { display: flex !important; }
              .m-mobile-cta { display: none !important; }
            }

            /* Dropdown */
            .m-nav-dropdown {
              position: relative;
            }
            .m-nav-dropdown-menu {
              display: none;
              position: absolute;
              top: calc(100% + 12px);
              left: 50%;
              transform: translateX(-50%);
              min-width: 220px;
              background: #fff;
              border: 1px solid var(--m-border-base);
              border-radius: 12px;
              padding: 12px 0;
              box-shadow: 0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
              z-index: 100;
            }
            .m-nav-dropdown-menu::before {
              content: '';
              position: absolute;
              top: -12px;
              left: 0;
              right: 0;
              height: 12px;
            }
            .m-nav-dropdown:hover .m-nav-dropdown-menu,
            .m-nav-dropdown:focus-within .m-nav-dropdown-menu {
              display: block;
            }
            .m-nav-dropdown-label {
              font-family: var(--font-jetbrains-mono), monospace;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: var(--m-text-muted);
              padding: 4px 20px 6px;
              margin: 0;
            }
            .m-nav-dropdown-item {
              display: block;
              padding: 8px 20px;
              font-size: 14px;
              font-weight: 500;
              color: var(--m-text-secondary);
              text-decoration: none;
              transition: background 0.15s, color 0.15s;
            }
            .m-nav-dropdown-item:hover {
              background: var(--m-green-light, #F0FDF4);
              color: var(--m-green-dark, #166534);
            }
          `,
        }}
      />
    </>
  );
}
