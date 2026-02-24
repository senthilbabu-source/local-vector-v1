// ---------------------------------------------------------------------------
// /terms — Terms of Service (Sprint 25B)
//
// Standard SaaS boilerplate. Review with legal counsel before launch.
// Static Server Component — no auth required.
// ---------------------------------------------------------------------------

export default function TermsPage() {
  const effectiveDate = 'February 23, 2026';

  return (
    <main className="min-h-screen bg-midnight-slate text-slate-300">

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 border-b border-white/5 bg-midnight-slate/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-bold text-signal-green tracking-tight hover:opacity-80 transition">
            LocalVector
          </a>
        </div>
      </nav>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <article className="mx-auto max-w-3xl px-6 py-12 space-y-8">

        {/* Header */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">
            ⚠️ Please review with your legal counsel before launch.
          </p>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate-500">Effective date: {effectiveDate}</p>
        </div>

        <ProseSection title="1. Acceptance of Terms">
          By accessing or using LocalVector.ai (&ldquo;LocalVector&rdquo;, &ldquo;the Service&rdquo;), you agree
          to be bound by these Terms of Service. If you do not agree, do not use the Service. These Terms apply
          to all users, including free and paid accounts.
        </ProseSection>

        <ProseSection title="2. Description of Service">
          LocalVector is an Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO) platform
          that helps businesses detect and correct AI hallucinations about their business data, and distribute
          accurate structured data to AI systems, search engines, and business listing platforms.
        </ProseSection>

        <ProseSection title="3. Account Registration">
          You must provide accurate and complete information when creating an account. You are responsible for
          maintaining the confidentiality of your credentials and for all activity that occurs under your account.
          You must be at least 18 years old and have authority to bind a business to these Terms.
        </ProseSection>

        <ProseSection title="4. Acceptable Use">
          You agree not to:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Use the Service to scrape, abuse, or make unauthorized API calls to third-party platforms.</li>
            <li>Submit false, misleading, or defamatory business information.</li>
            <li>Attempt to reverse-engineer, copy, or resell the Service without written permission.</li>
            <li>Violate any applicable law or regulation.</li>
            <li>Interfere with the security or integrity of the Service or its infrastructure.</li>
          </ul>
        </ProseSection>

        <ProseSection title="5. Payment and Refunds">
          Paid plans are billed monthly in advance. Agency plans are billed as negotiated. Charges are
          non-refundable except where required by law. You may cancel your subscription at any time; access
          continues until the end of the current billing period. We reserve the right to change pricing with
          30 days&apos; notice.
        </ProseSection>

        <ProseSection title="6. Intellectual Property">
          <strong className="text-slate-300">Your data:</strong> You own all business data and content you
          submit to the Service. You grant LocalVector a limited license to process and display that data
          solely to provide the Service.
          <br /><br />
          <strong className="text-slate-300">Our platform:</strong> LocalVector owns all rights to the
          platform, software, algorithms, and brand. Nothing in these Terms transfers ownership of our
          intellectual property to you.
        </ProseSection>

        <ProseSection title="7. Disclaimer of Warranties">
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY
          KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT AI SCAN RESULTS ARE COMPLETE,
          ACCURATE, OR ERROR-FREE.
        </ProseSection>

        <ProseSection title="8. Limitation of Liability">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOCALVECTOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF REVENUE, DATA, OR BUSINESS. IN NO EVENT
          SHALL OUR AGGREGATE LIABILITY EXCEED THE AMOUNTS PAID BY YOU IN THE TWELVE (12) MONTHS PRECEDING
          THE CLAIM.
        </ProseSection>

        <ProseSection title="9. Termination">
          We may suspend or terminate your account for material breach of these Terms, non-payment, or abuse of
          the Service, with notice where practicable. You may terminate your account at any time through the
          billing settings or by emailing{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>.
          Upon termination, your data will be retained per our Privacy Policy.
        </ProseSection>

        <ProseSection title="10. Governing Law">
          These Terms are governed by the laws of the State of Delaware, United States, without regard to
          conflict of law principles. Any disputes shall be resolved in the state or federal courts located in
          Delaware, and you consent to personal jurisdiction in such courts.
        </ProseSection>

        <ProseSection title="11. Changes to Terms">
          We may update these Terms periodically. We will notify you of material changes by email or in-app
          notice at least 14 days before they take effect. Continued use of the Service after changes
          constitutes acceptance of the updated Terms.
        </ProseSection>

        <ProseSection title="12. Contact">
          Questions about these Terms? Contact us at{' '}
          <a href="mailto:hello@localvector.ai" className="text-signal-green hover:underline">
            hello@localvector.ai
          </a>.
        </ProseSection>

      </article>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <LegalFooter />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ProseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-sm text-slate-400 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function LegalFooter() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="mx-auto max-w-3xl px-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <a href="/privacy" className="text-sm text-slate-500 hover:text-slate-300 transition">Privacy Policy</a>
        <span className="text-slate-700">·</span>
        <a href="/terms" className="text-sm text-slate-500 hover:text-slate-300 transition">Terms of Service</a>
        <span className="text-slate-700">·</span>
        <a href="mailto:hello@localvector.ai" className="text-sm text-slate-500 hover:text-slate-300 transition">
          hello@localvector.ai
        </a>
      </div>
    </footer>
  );
}
